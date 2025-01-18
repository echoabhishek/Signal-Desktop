import { MessageModel } from '../models/messages';

async function testMessageSend() {
  const testMessage = new MessageModel({
    body: 'Test message',
    conversationId: 'test-conversation-id',
    type: 'outgoing',
    sent_at: Date.now(),
  });

  console.log('Test message created:', testMessage);
  console.log('Message sending simulation complete.');
}

testMessageSend().catch(console.error);
