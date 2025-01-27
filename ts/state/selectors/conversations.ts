import { createSelector } from 'reselect';
import { StateType } from '../reducer';

export const getConversations = createSelector(
  (state: StateType) => state.conversations.conversationLookup,
  (conversationLookup) => {
    return Object.fromEntries(
      Object.entries(conversationLookup).filter(([_, conversation]) => !conversation.isBlocked)
    );
  }
);
