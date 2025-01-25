
import { assert } from 'chai';
import {
  getEmptyState,
  reducer,
  startAttachmentUpload,
  finishAttachmentUpload,
  replaceAttachments,
} from '../../../state/ducks/composer';
import { AttachmentDraftType } from '../../../types/Attachment';

describe('composer duck', () => {
  const testConversationId = 'test-conversation-id';

  describe('reducer', () => {
    it('should handle START_ATTACHMENT_UPLOAD', () => {
      const state = getEmptyState();
      const action = startAttachmentUpload(testConversationId);
      const newState = reducer(state, action);

      assert.isTrue(
        newState.conversations[testConversationId].isAttachmentBeingAdded
      );
    });

    it('should handle FINISH_ATTACHMENT_UPLOAD', () => {
      const initialState = getEmptyState();
      const startAction = startAttachmentUpload(testConversationId);
      const stateWithUpload = reducer(initialState, startAction);
      const finishAction = finishAttachmentUpload(testConversationId);
      const finalState = reducer(stateWithUpload, finishAction);

      assert.isFalse(
        finalState.conversations[testConversationId].isAttachmentBeingAdded
      );
    });

    it('should handle REPLACE_ATTACHMENTS', () => {
      const state = getEmptyState();
      const attachments: Array<AttachmentDraftType> = [
        { path: 'test-path', fileName: 'test.jpg', contentType: 'image/jpeg', size: 1024 },
      ];
      const action = replaceAttachments(testConversationId, attachments);
      const newState = reducer(state, action);

      assert.deepEqual(
        newState.conversations[testConversationId].attachments,
        attachments
      );
    });

    it('should not show media unavailable for stickers', () => {
      const state = getEmptyState();
      const stickerAttachment: AttachmentDraftType = {
        path: 'test-path',
        fileName: 'sticker.webp',
        contentType: 'application/x-signal-sticker',
        size: 1024,
      };
      const action = replaceAttachments(testConversationId, [stickerAttachment]);
      const newState = reducer(state, action);

      assert.isFalse(newState.conversations[testConversationId].isAttachmentBeingAdded);
      assert.lengthOf(newState.conversations[testConversationId].attachments, 1);
      assert.equal(
        newState.conversations[testConversationId].attachments[0].contentType,
        'application/x-signal-sticker'
      );
    });
  });
});
