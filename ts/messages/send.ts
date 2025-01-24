
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

import type { CustomError, MessageAttributesType } from '../model-types.d';
import type { CallbackResultType } from '../textsecure/Types.d';
import type { MessageModel } from '../models/messages';
import type { ServiceIdString } from '../types/ServiceId';
import type { SendStateByConversationId } from './MessageSendState';

/* eslint-disable more/no-then */

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
  log.info(`send: Starting message send process for message ${message.id}`);
  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );
  if (!conversation) {
    log.error(`send: Conversation not found for message ${message.id}`);
    throw new Error('Conversation not found');
  }
  const updateLeftPane = conversation.debouncedUpdateLastMessage ?? noop;

  updateLeftPane();

  let result:
    | { success: true; value: CallbackResultType }
    | {
        success: false;
        value: CustomError | SendMessageProtoError;
      };
  try {
    log.info(`send: Awaiting promise resolution for message ${message.id}`);
    const value = await (promise as Promise<CallbackResultType>);
    if (!value) {
      throw new Error('Promise resolved with null or undefined value');
    }
    result = { success: true, value };
    log.info(`send: Promise resolved successfully for message ${message.id}`);
  } catch (err) {
    log.error(`send: Error caught during promise resolution for message ${message.id}`, err);
    result = { success: false, value: err };
    if (saveErrors) {
      saveErrors([err]);
    }
  }

  updateLeftPane();

  const attributesToUpdate: Partial<MessageAttributesType> = {};

  if (result.success) {
    // This is used by sendSyncMessage, then set to null
    if ('dataMessage' in result.value && result.value.dataMessage) {
      attributesToUpdate.dataMessage = result.value.dataMessage;
      log.info(`send: dataMessage attribute updated for message ${message.id}`);
    } else if ('editMessage' in result.value && result.value.editMessage) {
      attributesToUpdate.dataMessage = result.value.editMessage;
      log.info(`send: editMessage attribute updated for message ${message.id}`);
    }
  } else {
    log.error(`send: Failed to send message ${message.id}`, result.value);
  }

  if (!message.doNotSave) {
    log.info(`send: Saving message ${message.id} to database`);
    try {
      await DataWriter.saveMessage(message.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      });
      log.info(`send: Message ${message.id} saved to database`);
    } catch (error) {
      log.error(`send: Error saving message ${message.id} to database`, error);
      throw error;
    }
  } else {
    log.info(`send: Message ${message.id} not saved due to doNotSave flag`);
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

  log.info(`send: Send state determined for message ${message.id}`, { sendIsFinal });

  // ... rest of the function ...

  if (!result.success) {
    throw result.value;
  }

  log.info(`send: Message ${message.id} sent successfully`);
}

// ... rest of the file content ...
