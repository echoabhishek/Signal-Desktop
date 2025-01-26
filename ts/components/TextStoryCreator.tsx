// ... (previous imports)

export function TextStoryCreator({
  debouncedMaybeGrabLinkPreview,
  i18n,
  isSending,
  linkPreview,
  onClose,
  onDone,
  onSetSkinTone,
  onUseEmoji,
  recentEmojis,
  skinTone,
}: PropsType): JSX.Element {
  const [showConfirmDiscardModal, setShowConfirmDiscardModal] = useState(false);
  const [showLinkPreviewPopup, setShowLinkPreviewPopup] = useState(false);
  const linkPreviewPopupRef = useRef<HTMLDivElement>(null);

  const onTryClose = useCallback(() => {
    setShowConfirmDiscardModal(true);
  }, [setShowConfirmDiscardModal]);

  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundStyleType>(BackgroundStyle.BG1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        linkPreviewPopupRef.current &&
        !linkPreviewPopupRef.current.contains(event.target as Node)
      ) {
        setShowLinkPreviewPopup(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ... (rest of the component code)

  return (
    // ... (existing JSX)
    {showLinkPreviewPopup && (
      <div
        ref={linkPreviewPopupRef}
        className="StoryCreator__popper StoryCreator__link-preview-input-popper"
      >
        <Input
          moduleClassName="StoryCreator__link-preview-input"
          placeholder={i18n('icu:StoryCreator__link-preview-placeholder')}
          // ... (other props)
        />
        <div className="StoryCreator__link-preview-container">
          {/* ... (rest of the link preview content) */}
        </div>
      </div>
    )}

    <button
      onClick={() => setShowLinkPreviewPopup(!showLinkPreviewPopup)}
      className="StoryCreator__link-preview-button"
    >
      {i18n('icu:StoryCreator__toggle-link-preview')}
    </button>
    // ... (rest of the JSX)
  );
}

