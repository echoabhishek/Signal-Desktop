// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/jsx-pascal-case */

import type {
  DetailedHTMLProps,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from 'react';
import React from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import getDirection from 'direction';
import { drop, groupBy, orderBy, take, unescape } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow';
import type { ReadonlyDeep } from 'type-fest';

import type {
  ConversationType,
  ConversationTypeType,
  InteractionModeType,
  PushPanelForConversationActionType,
  SaveAttachmentActionCreatorType,
  SaveAttachmentsActionCreatorType,
  ShowConversationType,
} from '../../state/ducks/conversations';
import type { ViewStoryActionCreatorType } from '../../state/ducks/stories';
import type { ReadStatus } from '../../messages/MessageReadStatus';
import { Avatar, AvatarSize } from '../Avatar';
import { AvatarSpacer } from '../AvatarSpacer';
import { Spinner } from '../Spinner';
import { MessageBodyReadMore } from './MessageBodyReadMore';
import { MessageMetadata } from './MessageMetadata';
import { MessageTextMetadataSpacer } from './MessageTextMetadataSpacer';
import { ImageGrid } from './ImageGrid';
import { GIF } from './GIF';
import { CurveType, Image } from './Image';
import { ContactName } from './ContactName';
import type { QuotedAttachmentForUIType } from './Quote';
import { Quote } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import type { OwnProps as ReactionViewerProps } from './ReactionViewer';
import { ReactionViewer } from './ReactionViewer';
import { Emoji } from '../emoji/Emoji';
import { LinkPreviewDate } from './LinkPreviewDate';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage';
import type { WidthBreakpoint } from '../_util';
import { OutgoingGiftBadgeModal } from '../OutgoingGiftBadgeModal';
import * as log from '../../logging/log';
import { StoryViewModeType } from '../../types/Stories';
import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment';
import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  getImageDimensions,
  hasImage,
  isDownloaded,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isImageAttachment,
  isVideo,
  isGIF,
  isPlayed,
  isDownloadable,
} from '../../types/Attachment';
import type { EmbeddedContactType } from '../../types/EmbeddedContact';

import { getIncrement } from '../../util/timer';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';
import { isFileDangerous } from '../../util/isFileDangerous';
import { missingCaseError } from '../../util/missingCaseError';
import type { HydratedBodyRangesType } from '../../types/BodyRange';
import type { LocalizerType, ThemeType } from '../../types/Util';

import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import type {
  ContactNameColorType,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { createRefMerger } from '../../util/refMerger';
import { emojiToData, getEmojiCount, hasNonEmojiText } from '../emoji/lib';
import { getCustomColorStyle } from '../../util/getCustomColorStyle';
import type { ServiceIdString } from '../../types/ServiceId';
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme';
import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { isPaymentNotificationEvent } from '../../types/Payment';
import type { AnyPaymentEvent } from '../../types/Payment';
import { getPaymentEventDescription } from '../../messages/helpers';
import { PanelType } from '../../types/Panels';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';
import { RenderLocation } from './MessageTextRenderer';
import { UserText } from '../UserText';
import { getColorForCallLink } from '../../util/getColorForCallLink';
import { getKeyFromCallLink } from '../../util/callLinks';
import { InAnotherCallTooltip } from './InAnotherCallTooltip';
import { formatFileSize } from '../../util/formatFileSize';

const GUESS_METADATA_WIDTH_TIMESTAMP_SIZE = 16;
const GUESS_METADATA_WIDTH_EXPIRE_TIMER_SIZE = 18;
const GUESS_METADATA_WIDTH_SMS_SIZE = 18;
const GUESS_METADATA_WIDTH_EDITED_SIZE = 40;
const GUESS_METADATA_WIDTH_OUTGOING_SIZE: Record<MessageStatusType, number> = {
  delivered: 24,
  error: 24,
  paused: 18,
  'partial-sent': 24,
  read: 24,
  sending: 18,
  sent: 24,
  viewed: 24,
};

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;
const GROUP_AVATAR_SIZE = AvatarSize.TWENTY_EIGHT;
const STICKER_SIZE = 200;
const GIF_SIZE = 300;
// Note: this needs to match the animation time
const TARGETED_TIMEOUT = 1200;
const SENT_STATUSES = new Set<MessageStatusType>([
  'delivered',
  'read',
  'sent',
  'viewed',
]);
const GIFT_BADGE_UPDATE_INTERVAL = 30 * SECOND;

enum MetadataPlacement {
  NotRendered,
  RenderedByMessageAudioComponent,
  InlineWithText,
  Bottom,
}

export enum TextDirection {
  LeftToRight = 'LeftToRight',
  RightToLeft = 'RightToLeft',
  Default = 'Default',
  None = 'None',
}

const TextDirectionToDirAttribute = {
  [TextDirection.LeftToRight]: 'ltr',
  [TextDirection.RightToLeft]: 'rtl',
  [TextDirection.Default]: 'auto',
  [TextDirection.None]: 'auto',
};

export const MessageStatuses = [
  'delivered',
  'error',
  'paused',
  'partial-sent',
  'read',
  'sending',
  'sent',
  'viewed',
] as const;
export type MessageStatusType = (typeof MessageStatuses)[number];

export const Directions = ['incoming', 'outgoing'] as const;
export type DirectionType = (typeof Directions)[number];

export type AudioAttachmentProps = {
  renderingContext: string;
  i18n: LocalizerType;
  buttonRef: React.RefObject<HTMLButtonElement>;
  theme: ThemeType | undefined;
  attachment: AttachmentForUIType;
  collapseMetadata: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;

  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  conversationId: string;
  played: boolean;
  pushPanelForConversation: PushPanelForConversationActionType;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;

  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
};

export enum GiftBadgeStates {
  Unopened = 'Unopened',
  Opened = 'Opened',
  Redeemed = 'Redeemed',
  Failed = 'Failed',
}

export type GiftBadgeType =
  | {
      state:
        | GiftBadgeStates.Unopened
        | GiftBadgeStates.Opened
        | GiftBadgeStates.Redeemed;
      expiration: number;
      id: string | undefined;
      level: number;
    }
  | {
      state: GiftBadgeStates.Failed;
    };

export type PropsData = {
  showMediaUnavailableIcon: boolean;
  id: string;
  renderingContext: string;
  contactNameColor?: ContactNameColorType;
  conversationColor: ConversationColorType;
  conversationTitle: string;
  customColor?: CustomColorType;
  conversationId: string;
  displayLimit?: number;
  activeCallConversationId?: string;
  text?: string;
  textDirection: TextDirection;
  textAttachment?: AttachmentForUIType;
  isEditedMessage?: boolean;
  isSticker?: boolean;
  isTargeted?: boolean;
  isTargetedCounter?: number;
  isSelected: boolean;
  isSelectMode: boolean;
  isSMS: boolean;
  isSpoilerExpanded?: Record<number, boolean>;
  direction: DirectionType;
  timestamp: number;
  receivedAtMS?: number;
  status?: MessageStatusType;
  contact?: ReadonlyDeep<EmbeddedContactType>;
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'unblurredAvatarUrl'
  >;
  conversationType: ConversationTypeType;
  attachments?: ReadonlyArray<AttachmentForUIType>;
  giftBadge?: GiftBadgeType;
  payment?: AnyPaymentEvent;
  quote?: {
    conversationColor: ConversationColorType;
    conversationTitle: string;
    customColor?: CustomColorType;
    text: string;
    rawAttachment?: QuotedAttachmentForUIType;
    payment?: AnyPaymentEvent;
    isFromMe: boolean;
    sentAt: number;
    authorId: string;
    authorPhoneNumber?: string;
    authorProfileName?: string;
    authorTitle: string;
    authorName?: string;
    bodyRanges?: HydratedBodyRangesType;
    referencedMessageNotFound: boolean;
    isViewOnce: boolean;
    isGiftBadge: boolean;
  };
  storyReplyContext?: {
    authorTitle: string;
    conversationColor: ConversationColorType;
    customColor?: CustomColorType;
    emoji?: string;
    isFromMe: boolean;
    rawAttachment?: QuotedAttachmentForUIType;
    storyId?: string;
    text: string;
  };
  previews: ReadonlyArray<LinkPreviewType>;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

  readStatus?: ReadStatus;

  expirationLength?: number;
  expirationTimestamp?: number;

  reactions?: ReactionViewerProps['reactions'];

  deletedForEveryone?: boolean;
  attachmentDroppedDueToSize?: boolean;

  canDeleteForEveryone: boolean;
  isBlocked: boolean;
  isMessageRequestAccepted: boolean;
  bodyRanges?: HydratedBodyRangesType;

  renderMenu?: () => JSX.Element | undefined;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;

  item?: never;
  // test-only, to force GIF's reduced motion experience
  _forceTapToPlay?: boolean;
};

export type PropsHousekeeping = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  disableScroll?: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  platform: string;
  renderAudioAttachment: (props: AudioAttachmentProps) => JSX.Element;
  shouldCollapseAbove: boolean;
  shouldCollapseBelow: boolean;
  shouldHideMetadata: boolean;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  theme: ThemeType;
};

export type PropsActions = {
  clearTargetedMessage: () => unknown;
  doubleCheckMissingQuoteReference: (messageId: string) => unknown;
  messageExpanded: (id: string, displayLimit: number) => unknown;
  checkForAccount: (phoneNumber: string) => unknown;

  startConversation: (e164: string, serviceId: ServiceIdString) => void;
  showConversation: ShowConversationType;
  openGiftBadge: (messageId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  retryMessageSend: (messageId: string) => unknown;
  showContactModal: (contactId: string, conversationId?: string) => void;
  showSpoiler: (messageId: string, data: Record<number, boolean>) => void;

  cancelAttachmentDownload: (options: { messageId: string }) => void;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  markAttachmentAsCorrupted: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  saveAttachment: SaveAttachmentActionCreatorType;
  saveAttachments: SaveAttachmentsActionCreatorType;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  showLightboxForViewOnceMedia: (messageId: string) => unknown;

  scrollToQuotedMessage: (options: {
    authorId: string;
    conversationId: string;
    sentAt: number;
  }) => void;
  targetMessage?: (messageId: string, conversationId: string) => unknown;

  showEditHistoryModal?: (id: string) => unknown;
  showAttachmentDownloadStillInProgressToast: (count: number) => unknown;
  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  showMediaNoLongerAvailableToast: () => unknown;
  viewStory: ViewStoryActionCreatorType;

  onToggleSelect: (selected: boolean, shift: boolean) => void;
  onReplyToMessage: () => void;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

type State = {
  metadataWidth: number;

  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  isTargeted?: boolean;
  prevTargetedCounter?: number;

  reactionViewerRoot: HTMLDivElement | null;
  reactionViewerOutsideClickDestructor?: () => void;

  giftBadgeCounter: number | null;
  showOutgoingGiftBadgeModal: boolean;

  hasDeleteForEveryoneTimerExpired: boolean;
};

export class Message extends React.PureComponent<Props, State> {
  // ... existing class content ...

  public override render(): JSX.Element | null {
    const { showMediaUnavailableIcon } = this.props;

    return (
      <div className="message-container">
        {showMediaUnavailableIcon && (
          <div className="media-unavailable-icon">Media no longer available</div>
        )}
        {/* Rest of the existing render method */}
      </div>
    );
  }

  // ... rest of the existing class methods ...
}
