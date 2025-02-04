
import { assert } from 'chai';
import { isConversationUnread } from '../util/isConversationUnread';

describe('Unread count functionality', () => {
  describe('isConversationUnread', () => {
    it('should return true when unreadCount is greater than 0', () => {
      assert.isTrue(isConversationUnread({ unreadCount: 1 }));
      assert.isTrue(isConversationUnread({ unreadCount: 10 }));
    });

    it('should return false when unreadCount is 0', () => {
      assert.isFalse(isConversationUnread({ unreadCount: 0 }));
    });

    it('should return true when markedUnread is true, regardless of unreadCount', () => {
      assert.isTrue(isConversationUnread({ markedUnread: true, unreadCount: 0 }));
      assert.isTrue(isConversationUnread({ markedUnread: true, unreadCount: 1 }));
    });

    it('should return false when both markedUnread and unreadCount are falsy', () => {
      assert.isFalse(isConversationUnread({}));
      assert.isFalse(isConversationUnread({ markedUnread: false, unreadCount: 0 }));
    });
  });
});
