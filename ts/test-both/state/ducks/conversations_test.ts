
import { deleteConversation } from '../../../state/ducks/conversations';
import { getConversationSelector } from '../../../state/selectors/conversations';

// Mock the necessary dependencies
jest.mock('../../../state/selectors/conversations');
jest.mock('../../../sql/Client');
jest.mock('../../../logging/log');

describe('deleteConversation', () => {
  it('should delete a conversation and sync with server', async () => {
    const mockConversation = { id: '123', title: 'Test Conversation' };
    const mockDispatch = jest.fn();
    const mockGetState = jest.fn();
    const mockUpdateConversation = jest.fn();
    const mockSyncDeleteConversation = jest.fn();

    getConversationSelector.mockReturnValue(() => mockConversation);
    window.textsecure = { messaging: { syncDeleteConversation: mockSyncDeleteConversation } };
    window.DataWriter = { updateConversation: mockUpdateConversation };

    await deleteConversation('123')(mockDispatch, mockGetState);

    expect(mockUpdateConversation).toHaveBeenCalledWith({
      ...mockConversation,
      isDeleted: true,
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REMOVE_CONVERSATION',
      payload: { conversationId: '123' },
    });
    expect(mockSyncDeleteConversation).toHaveBeenCalledWith('123');
  });
});
