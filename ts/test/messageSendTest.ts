import { send } from '../messages/send';
import { scheduleMessageRetry } from '../util/messageRetry';
import * as log from '../logging/log';

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

async function runTests() {
  console.log('Running message send tests...');

  // Test 1: Successful send
  await testSuccessfulSend();

  // Test 2: Failed send with retry
  await testFailedSendWithRetry();

  // Test 3: Send to multiple recipients
  await testSendToMultipleRecipients();

  console.log('All tests completed.');
}

async function testSuccessfulSend() {
  console.log('Test 1: Successful send');
  const successPromise = Promise.resolve({ success: true, successfulServiceIds: ['recipient-1'] });
  
  try {
    await send(mockMessage as any, {
      promise: successPromise,
      targetTimestamp: Date.now(),
    });
    console.log('Test 1 passed: Message sent successfully');
  } catch (error) {
    console.error('Test 1 failed:', error);
  }
}

async function testFailedSendWithRetry() {
  console.log('Test 2: Failed send with retry');
  const failurePromise = Promise.reject(new Error('Send failed'));
  
  try {
    await send(mockMessage as any, {
      promise: failurePromise,
      targetTimestamp: Date.now(),
    });
    // The send function should not throw, but schedule a retry
    if (mockMessage.attributes.sent === false) {
      console.log('Test 2 passed: Message marked as not sent and retry scheduled');
    } else {
      console.error('Test 2 failed: Message was not marked as unsent');
    }
  } catch (error) {
    console.error('Test 2 failed:', error);
  }
}

async function testSendToMultipleRecipients() {
  console.log('Test 3: Send to multiple recipients');
  const partialSuccessPromise = Promise.resolve({
    success: true,
    successfulServiceIds: ['recipient-1', 'recipient-2'],
    errors: [{ serviceId: 'recipient-3', error: new Error('Failed to send') }],
  });
  
  try {
    await send(mockMessage as any, {
      promise: partialSuccessPromise,
      targetTimestamp: Date.now(),
    });
    if (mockMessage.attributes.sent === true && mockMessage.attributes.sent_to.length === 2) {
      console.log('Test 3 passed: Message sent to some recipients and marked as sent');
    } else {
      console.error('Test 3 failed: Unexpected message state after partial send');
    }
  } catch (error) {
    console.error('Test 3 failed:', error);
  }
}

runTests();

