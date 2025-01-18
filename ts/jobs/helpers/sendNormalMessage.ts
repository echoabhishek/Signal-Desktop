// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import PQueue from 'p-queue';

import { DataWriter } from '../../sql/Client';
import * as Errors from '../../types/errors';
import { strictAssert } from '../../util/assert';
import type { MessageModel } from '../../models/messages';
import { getMessageById } from '../../messages/getMessageById';
import type { ConversationModel } from '../../models/conversations';
import { isGroup, isGroupV2, isMe } from '../../util/whatTypeOfConversation';
import { getSendOptions } from '../../util/getSendOptions';
import { SignalService as Proto } from '../../protobuf';
import { handleMessageSend } from '../../util/handleMessageSend';
import { findAndFormatContact } from '../../util/findAndFormatContact';
import { uploadAttachment } from '../../util/uploadAttachment';
import type { CallbackResultType } from '../../textsecure/Types.d';
import { isSent } from '../../messages/MessageSendState';
import { isOutgoing, canReact } from '../../state/selectors/message';
import type {
  ConversationQueueJobBundle,
  NormalMessageSendJobData,
} from '../conversationJobQueue';
import { send, sendSyncMessageOnly } from '../../messages/send';
import { scheduleMessageRetry } from '../../util/messageRetry';

const MAX_CONCURRENT_ATTACHMENT_UPLOADS = 5;

export async function sendNormalMessage(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: NormalMessageSendJobData
): Promise<void> {
  const { Message } = window.Signal.Types;

  const { messageId, revision, editedMessageTimestamp } = data;
  const message = await getMessageById(messageId);
  if (!message) {
    log.info(
      `message ${messageId} was not found, maybe because it was deleted. Giving up on sending it`
    );
    return;
  }

  const messageConversation = window.ConversationController.get(
    message.get('conversationId')
  );
  if (messageConversation !== conversation) {
    log.error(
      `Message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
    );
    return;
  }

  if (!isOutgoing(message.attributes)) {
    log.error(
      `message ${messageId} was not an outgoing message to begin with. This is probably a bogus job. Giving up on sending it`
    );
    return;
  }

  if (message.get('isErased') || message.get('deletedForEveryone')) {
    log.info(`message ${messageId} was erased. Giving up on sending it`);
    return;
  }

  const messageTimestamp = getMessageSentTimestamp(message.attributes, {
    includeEdits: false,
    log,
  });
  const targetTimestamp = editedMessageTimestamp || messageTimestamp;

  let messageSendErrors: Array<Error> = [];

  const saveErrors = isFinalAttempt
    ? undefined
    : (errors: Array<Error>) => {
        messageSendErrors = errors;
      };

  if (!shouldContinue) {
    log.info(`message ${messageId} ran out of time. Scheduling retry`);
    await scheduleMessageRetry(messageId);
    return;
  }

  try {
    const {
      allRecipientServiceIds,
      recipientServiceIdsWithoutMe,
      sentRecipientServiceIds,
      untrustedServiceIds,
    } = getMessageRecipients({
      log,
      message,
      conversation,
      targetTimestamp,
    });

    if (untrustedServiceIds.length) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedServiceIds,
        }
      );
      throw new Error(
        `Message ${messageId} sending blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
      );
    }

    if (!allRecipientServiceIds.length) {
      log.warn(
        `trying to send message ${messageId} but it looks like it was already sent to everyone. This is unexpected, but we're giving up`
      );
      return;
    }

    const sendData = await getMessageSendData({ log, message, targetTimestamp });

    log.info(
      'Sending normal message;',
      `editedMessageTimestamp=${editedMessageTimestamp},`,
      `storyMessage=${Boolean(sendData.storyMessage)}`
    );

    let messageSendPromise: Promise<CallbackResultType | void>;

    if (recipientServiceIdsWithoutMe.length === 0) {
      if (
        !isMe(conversation.attributes) &&
        !isGroup(conversation.attributes) &&
        sentRecipientServiceIds.length === 0
      ) {
        log.info(
          'No recipients; not sending to ourselves or to group, and no successful sends. Scheduling retry.'
        );
        await scheduleMessageRetry(messageId);
        return;
      }

      log.info('sending sync message only');
      const dataMessage = await messaging.getDataOrEditMessage({
        ...sendData,
        expireTimerVersion: conversation.getExpireTimerVersion(),
        groupV2: conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        }),
        recipients: allRecipientServiceIds,
        timestamp: targetTimestamp,
      });
      messageSendPromise = sendSyncMessageOnly(message, {
        dataMessage,
        saveErrors,
        targetTimestamp,
      });
    } else {
      const conversationType = conversation.get('type');
      const sendOptions = await getSendOptions(conversation.attributes);

      let innerPromise: Promise<CallbackResultType>;
      if (conversationType === Message.GROUP) {
        if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
          log.error('No revision provided, but conversation is GroupV2');
        }

        const groupV2Info = conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        });

        innerPromise = sendToGroup({
          ...sendData,
          conversation,
          groupV2: groupV2Info,
          messageId,
          revision,
          sendOptions,
          targetTimestamp,
        });
      } else {
        strictAssert(
          conversationType === Message.PRIVATE,
          'Conversation type should be private'
        );
        innerPromise = messaging.sendMessageToServiceId({
          ...sendData,
          messageId,
          serviceId: recipientServiceIdsWithoutMe[0],
          sendOptions,
          targetTimestamp,
          urgent: true,
        });
      }

      messageSendPromise = send(message, {
        promise: innerPromise,
        saveErrors,
        targetTimestamp,
      });
    }

    await messageSendPromise;

    const didFullySend =
      !messageSendErrors.length ||
      messageSendErrors.every(error => error.code === 428);

    await handleMessageSend({
      ...sendData,
      message,
      messageIds: [messageId],
      sendType: 'message',
      targetTimestamp,
      didFullySend,
    });

    if (didFullySend) {
      log.info(`Message ${messageId} sent successfully`);
    } else {
      log.warn(`Message ${messageId} failed to send to some recipients`);
      await scheduleMessageRetry(messageId);
    }

  } catch (error) {
    log.error(
      `Failed to send message ${messageId}:`,
      Errors.toLogFormat(error)
    );

    await scheduleMessageRetry(messageId);
  }
}

// Helper functions (implementations omitted for brevity)
function getMessageRecipients({ log, message, conversation, targetTimestamp }) {
  // Implementation details...
}

async function getMessageSendData({ log, message, targetTimestamp }) {
  // Implementation details...
}

async function sendToGroup({ conversation, groupV2, messageId, revision, sendOptions, targetTimestamp, ...sendData }) {
  // Implementation details...
}

