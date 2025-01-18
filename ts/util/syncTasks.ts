// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { ZodSchema } from 'zod';

import { drop } from './drop';
import * as log from '../logging/log';
import * as DeletesForMe from '../messageModifiers/DeletesForMe';
import {
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
  deleteAttachmentSchema,
} from '../textsecure/messageReceiverEvents';
import {
  receiptSyncTaskSchema,
  onReceipt,
} from '../messageModifiers/MessageReceipts';
import {
  deleteConversation,
  deleteLocalOnlyConversation,
  getConversationFromTarget,
} from './deleteForMe';
import {
  onSync as onReadSync,
  readSyncTaskSchema,
} from '../messageModifiers/ReadSyncs';
import {
  onSync as onViewSync,
  viewSyncTaskSchema,
} from '../messageModifiers/ViewSyncs';
import { safeParseUnknown } from './schemas';
import { DataWriter } from '../sql/Client';
import { isBlocked } from '../util/isBlocked';
import type { ConversationModel } from '../models/conversations';

const syncTaskDataSchema = z.union([
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
  deleteAttachmentSchema,
  receiptSyncTaskSchema,
  readSyncTaskSchema,
  viewSyncTaskSchema,
]);
export type SyncTaskData = z.infer<typeof syncTaskDataSchema>;

export type SyncTaskType = Readonly<{
  id: string;
  attempts: number;
  createdAt: number;
  data: unknown;
  envelopeId: string;
  sentAt: number;
  type: SyncTaskData['type'];
}>;

const SCHEMAS_BY_TYPE: Record<SyncTaskData['type'], ZodSchema> = {
  'delete-message': deleteMessageSchema,
  'delete-conversation': deleteConversationSchema,
  'delete-local-conversation': deleteLocalConversationSchema,
  'delete-single-attachment': deleteAttachmentSchema,
  Delivery: receiptSyncTaskSchema,
  Read: receiptSyncTaskSchema,
  View: receiptSyncTaskSchema,
  ReadSync: readSyncTaskSchema,
  ViewSync: viewSyncTaskSchema,
};

function toLogId(task: SyncTaskType) {
  return `type=${task.type},envelopeId=${task.envelopeId}`;
}

export async function queueSyncTasks(
  tasks: Array<SyncTaskType>,
  removeSyncTaskById: (id: string) => Promise<void>
): Promise<void> {
  const logId = 'queueSyncTasks';

  for (let i = 0, max = tasks.length; i < max; i += 1) {
    const task = tasks[i];
    await processSyncTask(task, removeSyncTaskById);
  }
}

export async function processSyncTask(
  task: SyncTaskType,
  removeSyncTaskById: (id: string) => Promise<void>
): Promise<void> {
  const { id, envelopeId, type, sentAt, data } = task;
  const logId = `processSyncTask(${toLogId(task)})`;

  const parseResult = safeParseUnknown(syncTaskDataSchema, data);
  if (!parseResult.success) {
    log.error(`${logId}: Failed to parse. Deleting.`);
    await removeSyncTaskById(id);
    return;
  }

  const { data: parsed } = parseResult;

  if (parsed.type === 'delete-message') {
    await DeletesForMe.onDelete({
      conversation: parsed.conversation,
      envelopeId,
      message: parsed.message,
      syncTaskId: id,
      timestamp: sentAt,
    });
  } else if (parsed.type === 'delete-conversation' || parsed.type === 'delete-local-conversation') {
    const { conversation: targetConversation } = parsed;
    const conversation = getConversationFromTarget(targetConversation);
    if (!conversation) {
      log.error(`${logId}: Conversation not found!`);
      await removeSyncTaskById(id);
      return;
    }

    // Check if the conversation is blocked
    if (isBlocked(conversation.attributes)) {
      log.info(`${logId}: Conversation is blocked. Ensuring deletion.`);
      await ensureBlockedConversationDeleted(conversation, id, removeSyncTaskById);
      return;
    }

    // Proceed with existing delete logic
    await conversation.performIfNotPermanentlyDeleted(async () => {
      await conversation.queueJob(logId, async () => {
        const promises = conversation.getSavePromises();
        log.info(`${logId}: Waiting for message saves (${promises.length} items)...`);
        await Promise.all(promises);

        log.info(`${logId}: Starting delete...`);
        let result;
        if (parsed.type === 'delete-conversation') {
          const { mostRecentMessages, mostRecentNonExpiringMessages, isFullDelete } = parsed;
          result = await deleteConversation(
            conversation,
            mostRecentMessages,
            mostRecentNonExpiringMessages,
            isFullDelete,
            logId
          );
        } else {
          result = await deleteLocalOnlyConversation(conversation, logId);
        }
        if (result) {
          await removeSyncTaskById(id);
        }
        log.info(`${logId}: Done, result=${result}`);
      });
    }, 'delete conversation');
  } else if (parsed.type === 'delete-single-attachment') {
    const { conversation: targetConversation, messageId, attachmentId } = parsed;
    const conversation = getConversationFromTarget(targetConversation);
    if (!conversation) {
      log.error(`${logId}: Conversation not found!`);
      await removeSyncTaskById(id);
      return;
    }
    await conversation.performIfNotPermanentlyDeleted(async () => {
      await conversation.queueJob(logId, async () => {
        const promises = conversation.getSavePromises();
        log.info(`${logId}: Waiting for message saves (${promises.length} items)...`);
        await Promise.all(promises);

        log.info(`${logId}: Starting delete...`);
        const result = await DeletesForMe.onDeleteSingleAttachment({
          conversation,
          messageId,
          attachmentId,
          syncTaskId: id,
        });
        if (result) {
          await removeSyncTaskById(id);
        }
        log.info(`${logId}: Done, result=${result}`);
      });
    }, 'delete single attachment');
  } else if (parsed.type === 'Delivery' || parsed.type === 'Read' || parsed.type === 'View') {
    await onReceipt({
      envelopeId,
      receipt: parsed,
      syncTaskId: id,
      timestamp: sentAt,
    });
  } else if (parsed.type === 'ReadSync') {
    await onReadSync({
      envelopeId,
      readSync: parsed,
      syncTaskId: id,
      timestamp: sentAt,
    });
  } else if (parsed.type === 'ViewSync') {
    await onViewSync({
      envelopeId,
      viewSync: parsed,
      syncTaskId: id,
      timestamp: sentAt,
    });
  } else {
    throw new Error(`${logId}: Unknown type ${parsed.type}`);
  }
}

async function ensureBlockedConversationDeleted(
  conversation: ConversationModel,
  taskId: string,
  removeSyncTaskById: (id: string) => Promise<void>
) {
  const logId = `ensureBlockedConversationDeleted(${conversation.idForLogging()})`;

  await conversation.performIfNotPermanentlyDeleted(async () => {
    log.info(`${logId}: Permanently deleting blocked conversation`);

    // Delete all messages
    await conversation.deleteAllMessages();

    // Mark as permanently deleted
    await conversation.markAsPermanentlyDeleted();

    // Remove from the database
    await DataWriter.removeConversation(conversation.id);

    log.info(`${logId}: Blocked conversation permanently deleted`);
  }, 'ensure blocked conversation deleted');

  // Remove the sync task
  await removeSyncTaskById(taskId);
}

  // Note: There may still be some tasks in the database, but we expect to be
  // called again some time later to process them.
}

async function processSyncTasksBatch(
  logId: string,
  previousRowId: number | null
): Promise<number | null> {
  log.info('syncTasks: Fetching tasks');
  const result = await DataWriter.dequeueOldestSyncTasks(previousRowId);
  const syncTasks = result.tasks;

  if (syncTasks.length === 0) {
    log.info(`${logId}/syncTasks: No sync tasks to process, stopping`);
  } else {
    log.info(`${logId}/syncTasks: Queueing ${syncTasks.length} sync tasks`);
    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);
  }

  return result.lastRowId;
}

const A_TICK = Promise.resolve();

export async function runAllSyncTasks(): Promise<void> {
  let lastRowId: number | null = null;
  do {
    // eslint-disable-next-line no-await-in-loop
    lastRowId = await processSyncTasksBatch('Startup', lastRowId);
    // eslint-disable-next-line no-await-in-loop
    await A_TICK;
  } while (lastRowId != null);
}
