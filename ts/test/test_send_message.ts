import { send } from '../messages/send';
import * as log from '../logging/log';

// Mock dependencies
const mockMessage = {
  id: 'test-message-id',
  attributes: {
    conversationId: 'test-conversation-id',
  },
  get: (key: string) => null,
  set: (changes: object) => {},
};

const mockConversation = {
  id: 'test-conversation-id',
  debouncedUpdateLastMessage: () => {},
};

const mockWindow = {
  ConversationController: {
    get: (id: string) => mockConversation,
  },
  textsecure: {
    storage: {
      user: {
        getCheckedAci: () => 'test-aci',
      },
    },
  },
};

// @ts-ignore
global.window = mockWindow;

// Mock DataWriter
const mockDataWriter = {
  saveMessage: async () => {},
};

// @ts-ignore
global.DataWriter = mockDataWriter;

async function testSendMessage() {
  const mockPromise = new Promise<any>((resolve) => {
    setTimeout(() => {
      resolve({
        successfulServiceIds: ['recipient-1', 'recipient-2'],
        unidentifiedDeliveries: ['recipient-1'],
      });
    }, 100);
  });

  try {
    await send(mockMessage as any, {
      promise: mockPromise,
      targetTimestamp: Date.now(),
    });
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSendMessage();

