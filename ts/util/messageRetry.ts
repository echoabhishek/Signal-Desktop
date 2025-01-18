import * as log from '../logging/log';
import type { MessageModel } from '../models/messages';
import { send } from '../messages/send';
import { getMessageById } from '../messages/getMessageById';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000; // 5 seconds

export async function scheduleMessageRetry(messageId: string): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message) {
    log.error(`Cannot schedule retry for message ${messageId}: Message not found`);
    return;
  }

  const retryCount = message.get('sendAttempt') || 0;
  if (retryCount >= MAX_RETRIES) {
    log.warn(`Message ${messageId} has reached maximum retry attempts`);
    await markMessagePermanentlyFailed(message);
    return;
  }

  log.info(`Scheduling retry ${retryCount + 1} for message ${messageId}`);
  setTimeout(() => void retryMessageSend(messageId), RETRY_DELAY_MS);
}

async function retryMessageSend(messageId: string): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message) {
    log.error(`Cannot retry message ${messageId}: Message not found`);
    return;
  }

  log.info(`Retrying send for message ${messageId}`);

  try {
    await send(message, {
      promise: createSendPromise(message),
      targetTimestamp: message.get('sent_at'),
    });
  } catch (error) {
    log.error(`Retry failed for message ${messageId}:`, error);
    await scheduleMessageRetry(messageId);
  }
}

function createSendPromise(message: MessageModel): Promise<any> {
  // This function should create and return a promise that represents the actual sending of the message
  // The implementation will depend on your specific messaging infrastructure
  return Promise.resolve(); // Placeholder
}

async function markMessagePermanentlyFailed(message: MessageModel): Promise<void> {
  message.set({ sendStateByConversationId: {}, sent: false, permanentlyFailed: true });
  await message.save();
  log.error(`Message ${message.id} has been marked as permanently failed`);
  // Here you might want to add code to notify the user that the message failed to send
}

