
import { SendMessage } from '../../ts/textsecure/SendMessage';
import { checkNetworkConnectivity } from '../../ts/util/networkUtils';
import { retryWithExponentialBackoff } from '../../ts/util/retryUtils';
import * as log from '../../ts/logging/log';

async function testMessageSending() {
  const sendMessage = new SendMessage();
  
  // Test 1: Network connectivity check
  log.info('Test 1: Network connectivity check');
  const isConnected = await checkNetworkConnectivity();
  log.info(`Network connected: ${isConnected}`);

  // Test 2: Successful message send
  log.info('Test 2: Successful message send');
  try {
    const result = await sendMessage.sendMessage({
      messageOptions: {
        recipients: ['test-recipient'],
        timestamp: Date.now(),
      },
      contentHint: 1,
      groupId: undefined,
      urgent: true,
    });
    log.info('Message sent successfully:', result);
  } catch (error) {
    log.error('Failed to send message:', error);
  }

  // Test 3: Message send with network failure and retry
  log.info('Test 3: Message send with network failure and retry');
  let attemptCount = 0;
  const mockSendWithFailure = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Network error');
    }
    return { success: true };
  };

  try {
    const result = await retryWithExponentialBackoff(mockSendWithFailure, 'testSend');
    log.info('Message sent successfully after retries:', result);
  } catch (error) {
    log.error('Failed to send message after retries:', error);
  }

  // Test 4: Edge case - empty recipient list
  log.info('Test 4: Edge case - empty recipient list');
  try {
    await sendMessage.sendMessage({
      messageOptions: {
        recipients: [],
        timestamp: Date.now(),
      },
      contentHint: 1,
      groupId: undefined,
      urgent: true,
    });
  } catch (error) {
    log.info('Expected error for empty recipient list:', error);
  }

  // Test 5: Regression test - ensure existing functionality still works
  log.info('Test 5: Regression test - existing functionality');
  try {
    const result = await sendMessage.sendMessage({
      messageOptions: {
        recipients: ['test-recipient'],
        timestamp: Date.now(),
        body: 'Test message',
      },
      contentHint: 1,
      groupId: undefined,
      urgent: false,
      story: true,
    });
    log.info('Regression test passed:', result);
  } catch (error) {
    log.error('Regression test failed:', error);
  }

  // Test 6: No network connectivity
  log.info('Test 6: No network connectivity');
  const originalCheckNetworkConnectivity = checkNetworkConnectivity;
  try {
    // Mock checkNetworkConnectivity to return false
    (global as any).checkNetworkConnectivity = async () => false;
    await sendMessage.sendMessage({
      messageOptions: {
        recipients: ['test-recipient'],
        timestamp: Date.now(),
      },
      contentHint: 1,
      groupId: undefined,
      urgent: true,
    });
  } catch (error) {
    log.info('Expected error for no network connectivity:', error);
  } finally {
    // Restore original checkNetworkConnectivity
    (global as any).checkNetworkConnectivity = originalCheckNetworkConnectivity;
  }
}

testMessageSending().then(() => log.info('All tests completed'));
