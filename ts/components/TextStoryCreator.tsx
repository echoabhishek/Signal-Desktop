import React, { useCallback, useEffect, useRef, useState } from 'react';
import { handleOutsideClick } from '../util/handleOutsideClick';

// ... (existing imports)

export function TextStoryCreator(props: PropsType): JSX.Element {
  // ... (existing code)

  const [linkPreviewApplied, setLinkPreviewApplied] = useState(LinkPreviewApplied.None);
  const linkPreviewPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (linkPreviewApplied !== LinkPreviewApplied.None && linkPreviewPopupRef.current) {
      return handleOutsideClick(linkPreviewPopupRef.current, () => {
        setLinkPreviewApplied(LinkPreviewApplied.None);
      });
    }
    return undefined;
  }, [linkPreviewApplied]);

  // ... (existing code)

  return (
    // ... (existing JSX)
    <div
      ref={linkPreviewPopupRef}
      className={classNames(
        'StoryCreator__popper StoryCreator__link-preview-input-popper',
        themeClassName(Theme.Dark)
      )}
      style={linkPreviewInputPopper.styles.popper}
      {...linkPreviewInputPopper.attributes.popper}
    >
      {/* ... (existing popup content) */}
    </div>
    // ... (existing JSX)
  );
}
