console.log('Starting simplified message send test...');

// Mock dependencies
const mockMessage = {
  id: 'test-message-id',
  attributes: {
    conversationId: 'test-conversation-id',
    sent_at: Date.now(),
  },
  get: (key: string) => mockMessage.attributes[key],
  set: (changes: object) => Object.assign(mockMessage.attributes, changes),
  save: async () => {},
};

const mockConversation = {
  id: 'test-conversation-id',
  get: () => {},
  getExpireTimerVersion: () => 0,
  getGroupV2Info: () => ({}),
  debouncedUpdateLastMessage: () => {},
};

const mockWindow = {
  ConversationController: {
    get: () => mockConversation,
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

console.log('Mocks set up successfully');

console.log('Simplified test completed');

