import { assert } from 'chai';
import { getConversations } from '../../../../ts/state/selectors/conversations';

describe('state/selectors/conversations', () => {
  describe('getConversations', () => {
    it('should filter out blocked conversations', () => {
      const state = {
        conversations: {
          conversationLookup: {
            'conversation-1': { id: 'conversation-1', isBlocked: false },
            'conversation-2': { id: 'conversation-2', isBlocked: true },
            'conversation-3': { id: 'conversation-3', isBlocked: false },
          },
        },
      };

      const result = getConversations(state);

      assert.deepEqual(Object.keys(result), ['conversation-1', 'conversation-3']);
      assert.isUndefined(result['conversation-2']);
    });
  });
});
