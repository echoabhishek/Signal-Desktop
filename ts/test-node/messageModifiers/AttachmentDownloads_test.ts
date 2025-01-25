import { assert } from 'chai';
import * as sinon from 'sinon';
import { addAttachmentToMessage } from '../../../messageModifiers/AttachmentDownloads';
import { getMessageById } from '../../../messages/getMessageById';

describe('AttachmentDownloads', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('addAttachmentToMessage', () => {
    it('should mark sticker attachments as available', async () => {
      const messageId = 'test-message-id';
      const attachment = {
        contentType: 'image/webp',
        sticker: {},
      };
      const message = {
        id: messageId,
        get: sinon.stub(),
        set: sinon.stub(),
      };

      sandbox.stub(getMessageById).resolves(message);

      await addAttachmentToMessage(messageId, attachment, 'test-job-id', { type: 'attachment' });

      assert.isTrue(message.set.calledOnce);
      const setCall = message.set.getCall(0);
      assert.deepEqual(setCall.args[0], {
        attachments: [{ ...attachment, isAvailable: true }],
      });
    });

    it('should not mark non-sticker attachments as available', async () => {
      const messageId = 'test-message-id';
      const attachment = {
        contentType: 'image/jpeg',
      };
      const message = {
        id: messageId,
        get: sinon.stub(),
        set: sinon.stub(),
      };

      sandbox.stub(getMessageById).resolves(message);

      await addAttachmentToMessage(messageId, attachment, 'test-job-id', { type: 'attachment' });

      assert.isTrue(message.set.calledOnce);
      const setCall = message.set.getCall(0);
      assert.deepEqual(setCall.args[0], {
        attachments: [attachment],
      });
    });
  });
});
