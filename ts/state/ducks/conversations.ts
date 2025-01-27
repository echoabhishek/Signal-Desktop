import { ThunkAction } from 'redux-thunk';
import { RootStateType } from '../reducer';
import { ConversationActionType } from './conversationTypes';
import { getConversationSelector } from '../selectors/conversations';
import { longRunningTaskWrapper } from '../../util/longRunningTaskWrapper';
import { getConversationIdForLogging } from '../../util/idForLogging';
import { Proto } from '../../protobuf';

export function blockConversation(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, ConversationActionType> {
  return async (dispatch, getState) => {
    const conversationSelector = getConversationSelector(getState());
    const conversation = conversationSelector(conversationId);

    if (!conversation) {
      throw new Error(
        'blockConversation: Expected a conversation to be found. Doing nothing'
      );
    }

    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;
    const idForLogging = getConversationIdForLogging(conversation);

    await longRunningTaskWrapper({
      name: 'blockConversation',
      idForLogging,
      task: async () => {
        await syncMessageRequestResponse(
          conversation,
          messageRequestEnum.BLOCK
        );
      },
    });

    dispatch({
      type: 'CONVERSATION_CHANGED',
      payload: {
        id: conversation.id,
        data: {
          ...conversation,
          isBlocked: true,
        },
      },
    });
  };
}

// Add any other necessary functions or imports here
