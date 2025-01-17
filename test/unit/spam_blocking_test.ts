
// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { Proto } from '../../ts/protobuf';
import { ConversationController } from '../../ts/ConversationController';

describe('Spam Blocking', () => {
  let sandbox: sinon.SinonSandbox;
  let conversation;
  let syncSpy;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    conversation = await ConversationController.getOrCreateAndWait('test-spam-id');
    syncSpy = sandbox.spy(conversation, 'syncMessageRequestResponse');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should block and delete spam conversations even on primary device', async () => {
    // Mock primary device status
    sandbox.stub(window.ConversationController, 'areWePrimaryDevice').returns(true);

    // Simulate blocking and deleting
    await conversation.applyMessageRequestResponse(
      Proto.SyncMessage.MessageRequestResponse.Type.BLOCK_AND_DELETE
    );

    // Verify conversation is blocked
    assert.isTrue(
      conversation.isBlocked(),
      'Conversation should be blocked'
    );

    // Verify messages are deleted
    const messageCount = await conversation.getMessageCount();
    assert.equal(messageCount, 0, 'Messages should be deleted');

    // Verify sync was attempted even though we're primary device
    assert.isTrue(
      syncSpy.called,
      'Sync should be attempted even on primary device'
    );
  });

  it('should prevent conversation from reappearing after block and delete', async () => {
    // Simulate blocking and deleting
    await conversation.applyMessageRequestResponse(
      Proto.SyncMessage.MessageRequestResponse.Type.BLOCK_AND_DELETE
    );

    // Attempt to recreate conversation (simulating a sync)
    const recreatedConversation = await ConversationController.getOrCreateAndWait('test-spam-id');

    // Verify conversation remains blocked
    assert.isTrue(
      recreatedConversation.isBlocked(),
      'Conversation should remain blocked after recreation attempt'
    );
  });
});
