// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop, union } from 'lodash';

import { filter, map } from '../util/iterables';
import { isNotNil } from '../util/isNotNil';
import { SendMessageProtoError } from '../textsecure/Errors';
import { getOwn } from '../util/getOwn';
import { isGroup } from '../util/whatTypeOfConversation';
import { handleMessageSend } from '../util/handleMessageSend';
import { getSendOptions } from '../util/getSendOptions';
import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import {
  getPropForTimestamp,
  getChangesForPropAtTimestamp,
} from '../util/editHelpers';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import {
  notifyStorySendFailed,
  saveErrorsOnMessage,
} from '../test-node/util/messageFailures';
import { postSaveUpdates } from '../util/cleanup';
import { isCustomError } from './helpers';
import { SendActionType, isSent, sendStateReducer } from './MessageSendState';
import { scheduleMessageRetry } from '../util/messageRetry';

import type { CustomError, MessageAttributesType } from '../model-types.d';
import type { CallbackResultType } from '../textsecure/Types.d';
import type { MessageModel } from '../models/messages';
import type { ServiceIdString } from '../types/ServiceId';
import type { SendStateByConversationId } from './MessageSendState';

const MAX_SEND_ATTEMPTS = 5;

export async function send(
  message: MessageModel,
  {
    promise,
    saveErrors,
    targetTimestamp,
  }: {
    promise: Promise<CallbackResultType | void | null>;
    saveErrors?: (errors: Array<Error>) => void;
    targetTimestamp: number;
  }
): Promise<void> {
  if (!message) {
    log.error('Attempted to send undefined or null message');
    return;
  }

  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );

  if (!conversation) {
    log.error(`No conversation found for message ${message.id}`);
    return;
  }

  const updateLeftPane = conversation?.debouncedUpdateLastMessage ?? noop;

  updateLeftPane();

  const sendAttempt = message.get('sendAttempt') || 0;
  message.set({ sendAttempt: sendAttempt + 1 });

  if (sendAttempt >= MAX_SEND_ATTEMPTS) {
    log.error(`Message ${message.id} has reached maximum send attempts. Marking as permanently failed.`);
    await markMessagePermanentlyFailed(message);
    return;
  }

  let result:
    | { success: true; value: CallbackResultType }
    | {
        success: false;
        value: CustomError | SendMessageProtoError;
      };
  try {
    log.info(`Attempting to send message ${message.id} (attempt ${sendAttempt + 1})`);
    const value = await (promise as Promise<CallbackResultType>);
    result = { success: true, value };
    log.info(`Successfully sent message ${message.id}`);
  } catch (err) {
    result = { success: false, value: err };
    log.error(`Failed to send message ${message.id}:`, err);
  }

  updateLeftPane();

  const attributesToUpdate: Partial<MessageAttributesType> = {};

  if ('dataMessage' in result.value && result.value.dataMessage) {
    attributesToUpdate.dataMessage = result.value.dataMessage;
  } else if ('editMessage' in result.value && result.value.editMessage) {
    attributesToUpdate.dataMessage = result.value.editMessage;
  }

  if (!message.doNotSave) {
    try {
      await DataWriter.saveMessage(message.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      });
      log.info(`Saved message ${message.id} to database`);
    } catch (error) {
      log.error(`Failed to save message ${message.id} to database:`, error);
    }
  }

  const sendStateByConversationId = {
    ...(getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    }) || {}),
  };

  const sendIsNotFinal =
    'sendIsNotFinal' in result.value && result.value.sendIsNotFinal;
  const sendIsFinal = !sendIsNotFinal;

  const successfulServiceIds: Array<ServiceIdString> =
    sendIsFinal &&
    'successfulServiceIds' in result.value &&
    Array.isArray(result.value.successfulServiceIds)
      ? result.value.successfulServiceIds
      : [];
  const sentToAtLeastOneRecipient =
    result.success || Boolean(successfulServiceIds.length);

  if (sentToAtLeastOneRecipient) {
    log.info(`Message ${message.id} sent to at least one recipient`);
  } else {
    log.warn(`Message ${message.id} failed to send to any recipients`);
  }

  successfulServiceIds.forEach(serviceId => {
    const targetConversation = window.ConversationController.get(serviceId);
    if (!targetConversation) {
      log.warn(`No conversation found for serviceId ${serviceId}`);
      return;
    }

    if (targetConversation.isEverUnregistered()) {
      targetConversation.setRegistered();
      log.info(`Marked conversation ${targetConversation.id} as registered`);
    }

    const previousSendState = getOwn(
      sendStateByConversationId,
      targetConversation.id
    );
    if (previousSendState) {
      sendStateByConversationId[targetConversation.id] = sendStateReducer(
        previousSendState,
        {
          type: SendActionType.Sent,
          updatedAt: Date.now(),
        }
      );
      log.info(`Updated send state for conversation ${targetConversation.id}`);
    }
  });

  const latestEditTimestamp = message.get('editMessageTimestamp');
  const sendIsLatest =
    !latestEditTimestamp || targetTimestamp === latestEditTimestamp;
  const previousUnidentifiedDeliveries =
    message.get('unidentifiedDeliveries') || [];
  const newUnidentifiedDeliveries =
    sendIsLatest &&
    'unidentifiedDeliveries' in result.value &&
    Array.isArray(result.value.unidentifiedDeliveries)
      ? union(previousUnidentifiedDeliveries, result.value.unidentifiedDeliveries)
      : previousUnidentifiedDeliveries;

  const errors = result.success ? [] : [result.value];
  const errorsToSave: Array<CustomError> = [];

  if (sendIsFinal) {
    if (errors.length) {
      log.error(`Failed to send message ${message.id}:`, errors);
      errorsToSave.push(...errors);
    }

    if (
      'errors' in result.value &&
      Array.isArray(result.value.errors) &&
      result.value.errors.length > 0
    ) {
      log.error(`Additional errors for message ${message.id}:`, result.value.errors);
      errorsToSave.push(...result.value.errors);
    }
  }

  if (saveErrors) {
    saveErrors(errorsToSave);
  }

  const changes = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'sendStateByConversationId',
    targetTimestamp,
    newValue: sendStateByConversationId,
  });

  if (changes) {
    message.set(changes);
    log.info(`Updated message ${message.id} with new send state`);
  }

  if (sendIsFinal) {
    message.set({
      ...changes,
      sent_to: successfulServiceIds,
      unidentifiedDeliveries: newUnidentifiedDeliveries,
      ...attributesToUpdate,
    });
    log.info(`Finalized message ${message.id} state`);
  }

  if (sentToAtLeastOneRecipient) {
    message.set({ sent: true });
    log.info(`Marked message ${message.id} as sent`);
  } else {
    message.set({ sent: false });
    log.warn(`Marked message ${message.id} as not sent`);
  }

  if (!message.doNotSave) {
    try {
      await DataWriter.saveMessage(message.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      });
      log.info(`Saved final state of message ${message.id} to database`);
    } catch (error) {
      log.error(`Failed to save final state of message ${message.id} to database:`, error);
    }
  }

  if (errorsToSave.length) {
    await saveErrorsOnMessage(message, errorsToSave);
    log.info(`Saved errors for message ${message.id}`);
  }

  if (!sentToAtLeastOneRecipient && sendAttempt < MAX_SEND_ATTEMPTS) {
    log.info(`Scheduling retry for message ${message.id}`);
    await scheduleMessageRetry(message.id);
  } else if (!sentToAtLeastOneRecipient) {
    log.error(`Message ${message.id} failed to send after ${MAX_SEND_ATTEMPTS} attempts. Marking as permanently failed.`);
    await markMessagePermanentlyFailed(message);
  }
}

async function markMessagePermanentlyFailed(message: MessageModel): Promise<void> {
  message.set({ sendStateByConversationId: {}, sent: false, permanentlyFailed: true });
  await message.save();
  log.error(`Message ${message.id} has been marked as permanently failed`);
  // Here you might want to add code to notify the user that the message failed to send
}

