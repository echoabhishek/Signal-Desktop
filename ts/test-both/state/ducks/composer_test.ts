
import { assert } from 'chai';
import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  getEmptyState,
  reducer,
  startAttachmentUpload,
  finishAttachmentUpload,
  replaceAttachments,
} from '../../../state/ducks/composer';
import { AttachmentDraftType, InMemoryAttachmentDraftType } from '../../../types/Attachment';
import * as Toast from '../../../state/ducks/toast';
import * as WriteDraftAttachment from '../../../util/writeDraftAttachment';

chai.use(chaiAsPromised);
const { expect } = chai;

const addAttachment = (conversationId: string, attachment: InMemoryAttachmentDraftType) => {
  // Mock implementation for testing purposes
  return async (dispatch: any, getState: any) => {
    dispatch(startAttachmentUpload(conversationId));
    try {
      const onDisk = await WriteDraftAttachment.writeDraftAttachment(attachment);
      const toAdd = { ...onDisk, clientUuid: 'test-uuid' };
      const state = getState();
      const { attachments } = state.composer.conversations[conversationId] || { attachments: [] };
      const newAttachments = [...attachments, toAdd];
      dispatch(replaceAttachments(conversationId, newAttachments));
    } catch (error) {
      Toast.showToast({ toastType: 'Error', message: 'icu:addAttachmentFailed' });
    } finally {
      dispatch(finishAttachmentUpload(conversationId));
    }
  };
};

describe('composer duck', () => {
  const testConversationId = 'test-conversation-id';
  let showToastStub: sinon.SinonStub;
  let writeDraftAttachmentStub: sinon.SinonStub;

  beforeEach(() => {
    showToastStub = sinon.stub(Toast, 'showToast');
    writeDraftAttachmentStub = sinon.stub(WriteDraftAttachment, 'writeDraftAttachment');
  });

  afterEach(() => {
    sinon.restore();
  });

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
        { path: 'test-path', fileName: 'test.jpg', contentType: 'image/jpeg', size: 1024, clientUuid: 'test-uuid', pending: true },
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
        clientUuid: 'test-uuid',
        pending: true,
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

    it('should reset isAttachmentBeingAdded when replacing attachments', () => {
      const initialState = getEmptyState();
      const startAction = startAttachmentUpload(testConversationId);
      const stateWithUpload = reducer(initialState, startAction);
      const attachments: Array<AttachmentDraftType> = [
        { path: 'test-path', fileName: 'test.jpg', contentType: 'image/jpeg', size: 1024, clientUuid: 'test-uuid', pending: true },
      ];
      const replaceAction = replaceAttachments(testConversationId, attachments);
      const finalState = reducer(stateWithUpload, replaceAction);

      assert.isFalse(finalState.conversations[testConversationId].isAttachmentBeingAdded);
      assert.deepEqual(finalState.conversations[testConversationId].attachments, attachments);
    });
  });

  describe('addAttachment', () => {
    it('should handle successful attachment upload', async () => {
      const dispatch = sinon.spy();
      const getState = sinon.stub().returns({
        composer: getEmptyState(),
      });
      const attachment: InMemoryAttachmentDraftType = {
        data: new Uint8Array([1, 2, 3]),
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
        size: 1024,
        clientUuid: 'test-uuid',
        pending: false,
      };

      writeDraftAttachmentStub.resolves({ ...attachment, clientUuid: 'test-uuid' });

      await addAttachment(testConversationId, attachment)(dispatch, getState);

      sinon.assert.calledWith(dispatch, startAttachmentUpload(testConversationId));
      sinon.assert.calledWith(dispatch, sinon.match({
        type: 'composer/REPLACE_ATTACHMENTS',
        payload: sinon.match({
          attachments: sinon.match.array.deepEquals([sinon.match(attachment)]),
        }),
      }));
      sinon.assert.calledWith(dispatch, finishAttachmentUpload(testConversationId));
    });

    it('should handle attachment upload failure', async () => {
      const dispatch = sinon.spy();
      const getState = sinon.stub().returns({
        composer: getEmptyState(),
      });
      const attachment: InMemoryAttachmentDraftType = {
        data: new Uint8Array([1, 2, 3]),
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
        size: 1024,
        clientUuid: 'test-uuid',
        pending: false,
      };

      writeDraftAttachmentStub.rejects(new Error('Upload failed'));

      await addAttachment(testConversationId, attachment)(dispatch, getState);

      sinon.assert.calledWith(dispatch, startAttachmentUpload(testConversationId));
      sinon.assert.calledWith(showToastStub, sinon.match({
        toastType: 'Error',
        message: 'icu:addAttachmentFailed',
      }));
      sinon.assert.calledWith(dispatch, sinon.match({
        type: 'composer/REPLACE_ATTACHMENTS',
        payload: sinon.match({
          attachments: [],
        }),
      }));
      sinon.assert.calledWith(dispatch, finishAttachmentUpload(testConversationId));
    });
  });
});
