import { ConversationController } from '../ConversationController';
import { MessageSender } from '../textsecure/SendMessage';
import * as log from '../logging/log';

export async function deleteConversation(conversationId: string): Promise<void> {
  const conversation = ConversationController.get(conversationId);
  if (!conversation) {
    log.warn('Attempted to delete non-existent conversation');
    return;
  }

  // Delete all messages
  await conversation.destroyMessages();

  // Remove from ConversationController
  ConversationController.remove(conversationId);

  // Remove from database
  await window.Signal.Data.removeConversation(conversationId, {
    Conversation: window.Whisper.Conversation,
  });

  // If the conversation is with a blocked contact, ensure it stays deleted
  if (conversation.isBlocked()) {
    await window.storage.put('deletedBlockedConversations', {
      ...window.storage.get('deletedBlockedConversations'),
      [conversationId]: Date.now(),
    });
  }

  log.info('Conversation deleted successfully', { conversationId });
}
