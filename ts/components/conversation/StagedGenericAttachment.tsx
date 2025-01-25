// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { AttachmentType } from '../../types/Attachment';
import { getExtensionForDisplay } from '../../types/Attachment';
import type { LocalizerType } from '../../types/Util';
import { shouldShowMediaNotAvailableIcon } from '../../util/attachmentAvailability';

export type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
  i18n: LocalizerType;
};

export function StagedGenericAttachment({
  attachment,
  i18n,
  onClose,
}: Props): JSX.Element {
  const { fileName, contentType } = attachment;
  const extension = getExtensionForDisplay({ contentType, fileName });
  const showMediaNotAvailableIcon = shouldShowMediaNotAvailableIcon(
    attachment,
    attachment.timestamp
  );

  return (
    <div className="module-staged-attachment module-staged-generic-attachment">
      <button
        type="button"
        className="module-staged-generic-attachment__close-button"
        aria-label={i18n('icu:close')}
        onClick={() => {
          if (onClose) {
            onClose(attachment);
          }
        }}
      />
      {showMediaNotAvailableIcon ? (
        <div className="module-staged-generic-attachment__media-not-available">
          <i className="module-staged-generic-attachment__media-not-available-icon" />
          <div className="module-staged-generic-attachment__media-not-available-text">
            {i18n('icu:mediaNoLongerAvailable')}
          </div>
        </div>
      ) : (
        <>
          <div className="module-staged-generic-attachment__icon">
            {extension ? (
              <div className="module-staged-generic-attachment__icon__extension">
                {extension}
              </div>
            ) : null}
          </div>
          <div className="module-staged-generic-attachment__filename">
            {fileName}
          </div>
        </>
      )}
    </div>
  );
}
