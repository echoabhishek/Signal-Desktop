
import { OutgoingMessage } from '../ts/textsecure/OutgoingMessage';
import * as log from '../ts/logging/log';
import { SignalService as Proto } from '../ts/protobuf';

jest.mock('../ts/logging/log');

describe('OutgoingMessage', () => {
  let outgoingMessage: OutgoingMessage;
  const mockServer = {
    sendMessages: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    outgoingMessage = new OutgoingMessage({
      callback: jest.fn(),
      contentHint: 1,
      groupId: undefined,
      serviceIds: ['test-service-id'],
      message: new Proto.Content(),
      options: {},
      sendLogCallback: jest.fn(),
      server: mockServer as any,
      timestamp: Date.now(),
      urgent: true,
    });
  });

  test('should retry sending message with exponential backoff', async () => {
    mockServer.sendMessages.mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({});

    await outgoingMessage.doSendMessage('test-service-id', [1], false);

    expect(mockServer.sendMessages).toHaveBeenCalledTimes(3);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Retrying after'));
  });

  test('should throw MessageTransmissionError after max retries', async () => {
    mockServer.sendMessages.mockRejectedValue(new Error('Network error'));

    await expect(outgoingMessage.doSendMessage('test-service-id', [1], false))
      .rejects.toThrow('Failed to transmit message to test-service-id after 3 attempts');

    expect(mockServer.sendMessages).toHaveBeenCalledTimes(4); // Initial attempt + 3 retries
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Max retries reached'));
  });

  test('should handle successful message send', async () => {
    mockServer.sendMessages.mockResolvedValueOnce({});

    await outgoingMessage.doSendMessage('test-service-id', [1], false);

    expect(mockServer.sendMessages).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Message transmitted successfully'));
  });
});
