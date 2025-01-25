// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as log from '../logging/log';
import * as Bytes from '../Bytes';
import type { AttachmentDownloadJobTypeType } from '../types/AttachmentDownload';

import type { AttachmentType } from '../types/Attachment';
import { getAttachmentSignatureSafe, isDownloaded } from '../types/Attachment';
import { getMessageById } from '../messages/getMessageById';

export async function markAttachmentAsCorrupted(
  messageId: string,
  attachment: AttachmentType
): Promise<void> {
  const message = await getMessageById(messageId);

  if (!message) {
    return;
  }

  if (!attachment.path) {
    throw new Error(
      "Attachment can't be marked as corrupted because it wasn't loaded"
    );
  }

  // We intentionally don't check in quotes/stickers/contacts/... here,
  // because this function should be called only for something that can
  // be displayed as a generic attachment.
  const attachments: ReadonlyArray<AttachmentType> =
    message.get('attachments') || [];

  let changed = false;
  const newAttachments = attachments.map(existing => {
    if (existing.path !== attachment.path) {
      return existing;
    }
    changed = true;

    return {
      ...existing,
      isCorrupted: true,
    };
  });

  if (!changed) {
    throw new Error(
      "Attachment can't be marked as corrupted because it wasn't found"
    );
  }

  log.info('markAttachmentAsCorrupted: marking an attachment as corrupted');

  message.set({
    attachments: newAttachments,
  });
}

export async function addAttachmentToMessage(
  messageId: string,
  attachment: AttachmentType,
  jobLogId: string,
  { type }: { type: AttachmentDownloadJobTypeType }
): Promise<void> {
  const logPrefix = `${jobLogId}/addAttachmentToMessage`;
  const message = await getMessageById(messageId);

  if (!message) {
    return;
  }

  const attachmentSignature = getAttachmentSignatureSafe(attachment);
  if (!attachmentSignature) {
    log.error(`${logPrefix}: Attachment did not have valid signature (digest)`);
  }

  // Check if the attachment is a sticker
  const isSticker = attachment.contentType && attachment.contentType.startsWith('image/') && attachment.sticker;

  // If it's a sticker, ensure it's marked as available
  if (isSticker) {
    attachment.isAvailable = true;
  }

  if (type === 'long-message') {
    let handledAnywhere = false;
    let attachmentData: Uint8Array | undefined;

    try {
      if (attachment.path) {
        const loaded =
          await window.Signal.Migrations.loadAttachmentData(attachment);
        attachmentData = loaded.data;
      }

      const editHistory = message.get('editHistory');
      if (editHistory) {
        let handledInEditHistory = false;

        const newEditHistory = editHistory.map(edit => {
          // We've already downloaded a bodyAttachment for this edit
          if (!edit.bodyAttachment) {
            return edit;
          }
          // This attachment isn't destined for this edit
          if (
            getAttachmentSignatureSafe(edit.bodyAttachment) !==
            attachmentSignature
          ) {
            return edit;
          }

          handledInEditHistory = true;
          handledAnywhere = true;

          // Attachment wasn't downloaded yet.
          if (!attachmentData) {
            return {
              ...edit,
              bodyAttachment: attachment,
            };
          }

          return {
            ...edit,
            body: Bytes.toString(attachmentData),
            bodyAttachment: attachment,
          };
        });

        if (handledInEditHistory) {
          message.set({ editHistory: newEditHistory });
        }
      }

      const existingBodyAttachment = message.get('bodyAttachment');
      // A bodyAttachment download might apply only to an edit, and not the top-level
      if (!existingBodyAttachment) {
        return;
      }
      if (
        getAttachmentSignatureSafe(existingBodyAttachment) !==
        attachmentSignature
      ) {
        return;
      }

      handledAnywhere = true;

      // Attachment wasn't downloaded yet.
      if (!attachmentData) {
        message.set({
          bodyAttachment: attachment,
        });
        return;
      }

      message.set({
        body: Bytes.toString(attachmentData),
        bodyAttachment: attachment,
      });
    } finally {
      if (attachment.path) {
        await window.Signal.Migrations.deleteAttachmentData(attachment.path);
      }
      if (!handledAnywhere) {
        log.warn(
          `${logPrefix}: Long message attachment found no matching place to apply`
        );
      }
    }
    return;
  }

  const maybeReplaceAttachment = (existing: AttachmentType): AttachmentType => {
    if (isDownloaded(existing)) {
      return existing;
    }

    if (attachmentSignature !== getAttachmentSignatureSafe(existing)) {
      return existing;
    }

    // Check if the attachment is a sticker and mark it as available
    if (attachment.contentType && attachment.contentType.startsWith('image/') && attachment.sticker) {
      return { ...attachment, isAvailable: true };
    }

    return attachment;
  };

if (type === 'attachment') {
  const attachments = message.get('attachments');
  const editHistory = message.get('editHistory');
  let handledAnywhere = false;

  const processAttachment = (item: AttachmentType) => {
    if (getAttachmentSignatureSafe(item) === attachmentSignature) {
      handledAnywhere = true;
      // Check if the attachment is a sticker and mark it as available
      if (item.contentType && item.contentType.startsWith('image/') && item.sticker) {
        return { ...attachment, isAvailable: true };
      }
      return attachment;
    }
    return item;
  };

  if (editHistory) {
    const newEditHistory = editHistory.map(edit => {
      if (!edit.attachments) {
        return edit;
      }

      const newAttachments = edit.attachments.map(processAttachment);

      if (newAttachments !== edit.attachments) {
        return {
          ...edit,
          attachments: newAttachments,
        };
      }

      return edit;
    });

    if (handledAnywhere) {
      message.set({ editHistory: newEditHistory });
    }
  }

  if (attachments) {
    const newAttachments = attachments.map(processAttachment);

    if (handledAnywhere) {
      message.set({ attachments: newAttachments });
    }
  }

  if (!handledAnywhere) {
    log.warn(
      `${logPrefix}: 'attachment' type found no matching place to apply`
    );
  }

  return;
}
