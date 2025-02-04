// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get } from 'lodash';
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { PropsType as DialogExpiredBuildPropsType } from '../../components/DialogExpiredBuild';
import { DialogExpiredBuild } from '../../components/DialogExpiredBuild';
import type { PropsType as LeftPanePropsType } from '../../components/LeftPane';
import { LeftPane } from '../../components/LeftPane';
import type { NavTabPanelProps } from '../../components/NavTabs';
import type { WidthBreakpoint } from '../../components/_util';
import {
  getGroupSizeHardLimit,
  getGroupSizeRecommendedLimit,
} from '../../groups/limits';
import { LeftPaneMode } from '../../types/leftPane';
import { getUsernameFromSearch } from '../../util/Username';
import { getCountryDataForLocale } from '../../util/getCountryData';
import { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId';
import { missingCaseError } from '../../util/missingCaseError';
import { isDone as isRegistrationDone } from '../../util/registration';
import { drop } from '../../util/drop';
import { useCallingActions } from '../ducks/calling';
import { useConversationsActions } from '../ducks/conversations';
import { ComposerStep, OneTimeModalState } from '../ducks/conversationsEnums';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useItemsActions } from '../ducks/items';
import { useNetworkActions } from '../ducks/network';
import { useSearchActions } from '../ducks/search';
import { useUsernameActions } from '../ducks/username';
import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getComposeAvatarData,
  getComposeGroupAvatar,
  getComposeGroupExpireTimer,
  getComposeGroupName,
  getComposeSelectedContacts,
  getComposerConversationSearchTerm,
  getComposerSelectedRegion,
  getComposerStep,
  getComposerUUIDFetchState,
  getFilteredCandidateContactsForNewGroup,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getLeftPaneLists,
  getMaximumGroupSizeModalState,
  getMe,
  getRecommendedGroupSizeModalState,
  getSelectedConversationId,
  getShowArchived,
  getTargetedMessage,
  hasGroupCreationError,
  isCreatingGroup,
  isEditingAvatar,
} from '../selectors/conversations';
import { getCrashReportCount } from '../selectors/crashReports';
import { hasExpired } from '../selectors/expiration';
import {
  getBackupMediaDownloadProgress,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
  getUsernameCorrupted,
  getUsernameLinkCorrupted,
} from '../selectors/items';
import {
  getChallengeStatus,
  hasNetworkDialog as getHasNetworkDialog,
} from '../selectors/network';
import {
  getFilterByUnread,
  getHasSearchQuery,
  getIsActivelySearching,
  getIsSearching,
  getIsSearchingGlobally,
  getQuery,
  getSearchConversation,
  getSearchResults,
  getStartSearchCounter,
} from '../selectors/search';
import {
  isUpdateDownloaded as getIsUpdateDownloaded,
  isOSUnsupported,
  isUpdateDialogVisible,
} from '../selectors/updates';
import {
  getIntl,
  getIsMacOS,
  getRegionCode,
  getTheme,
} from '../selectors/user';
import { SmartCaptchaDialog } from './CaptchaDialog';
import { SmartCrashReportDialog } from './CrashReportDialog';
import { SmartMessageSearchResult } from './MessageSearchResult';
import { SmartNetworkStatus } from './NetworkStatus';
import { SmartRelinkDialog } from './RelinkDialog';
import { SmartToastManager } from './ToastManager';
import type { PropsType as SmartUnsupportedOSDialogPropsType } from './UnsupportedOSDialog';
import { SmartUnsupportedOSDialog } from './UnsupportedOSDialog';
import { useSelector } from 'react-redux';
import { getConversations } from '../selectors/conversations';
import { isConversationUnread } from '../../util/isConversationUnread';

const getUnreadCount = (conversations) => {
  return conversations.reduce((count, conversation) => {
    if (isConversationUnread(conversation)) {
      return count + 1;
    }
    return count;
  }, 0);
};
import { SmartUpdateDialog } from './UpdateDialog';
import {
  cancelBackupMediaDownload,
  dismissBackupMediaDownloadBanner,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
} from '../../util/backupMediaDownload';

function renderMessageSearchResult(id: string): JSX.Element {
  return <SmartMessageSearchResult id={id} />;
}
function renderNetworkStatus(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartNetworkStatus {...props} />;
}
function renderRelinkDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartRelinkDialog {...props} />;
}
function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartUpdateDialog {...props} />;
}

function renderCaptchaDialog({ onSkip }: { onSkip(): void }): JSX.Element {
  return <SmartCaptchaDialog onSkip={onSkip} />;
}
function renderCrashReportDialog(): JSX.Element {
  return <SmartCrashReportDialog />;
}
function renderExpiredBuildDialog(
  props: DialogExpiredBuildPropsType
): JSX.Element {
  return <DialogExpiredBuild {...props} />;
}
function renderUnsupportedOSDialog(
  props: Readonly<SmartUnsupportedOSDialogPropsType>
): JSX.Element {
  return <SmartUnsupportedOSDialog {...props} />;
}
function renderToastManagerWithMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager {...props} />;
}

function renderToastManagerWithoutMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager disableMegaphone {...props} />;
}

const getModeSpecificProps = (
  state: StateType
): LeftPanePropsType['modeSpecificProps'] => {
  const i18n = getIntl(state);
  const composerStep = getComposerStep(state);
  switch (composerStep) {
    case undefined:
      if (getShowArchived(state)) {
        const { archivedConversations } = getLeftPaneLists(state);
        const searchConversation = getSearchConversation(state);
        const searchTerm = getQuery(state);
        return {
          mode: LeftPaneMode.Archive,
          archivedConversations,
          isSearchingGlobally: getIsSearchingGlobally(state),
          searchConversation,
          searchTerm,
          startSearchCounter: getStartSearchCounter(state),
          ...(searchConversation && searchTerm ? getSearchResults(state) : {}),
        };
      }
      if (getIsActivelySearching(state)) {
        const primarySendsSms = Boolean(
          get(state.items, ['primarySendsSms'], false)
        );

        return {
          mode: LeftPaneMode.Search,
          isSearchingGlobally: getIsSearchingGlobally(state),
          primarySendsSms,
          searchConversation: getSearchConversation(state),
          searchDisabled: state.network.challengeStatus !== 'idle',
          startSearchCounter: getStartSearchCounter(state),
          ...getSearchResults(state),
        };
      }
      return {
        mode: LeftPaneMode.Inbox,
        isAboutToSearch: getIsSearching(state),
        isSearchingGlobally: getIsSearchingGlobally(state),
        searchConversation: getSearchConversation(state),
        searchDisabled: state.network.challengeStatus !== 'idle',
        searchTerm: getQuery(state),
        startSearchCounter: getStartSearchCounter(state),
        filterByUnread: getFilterByUnread(state),
        ...getLeftPaneLists(state),
      };
    case ComposerStep.StartDirectConversation:
      return {
        mode: LeftPaneMode.Compose,
        composeContacts: getFilteredComposeContacts(state),
        composeGroups: getFilteredComposeGroups(state),
        regionCode: getRegionCode(state),
        searchTerm: getComposerConversationSearchTerm(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.FindByUsername:
      return {
        mode: LeftPaneMode.FindByUsername,
        searchTerm: getComposerConversationSearchTerm(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.FindByPhoneNumber:
      return {
        mode: LeftPaneMode.FindByPhoneNumber,
        searchTerm: getComposerConversationSearchTerm(state),
        regionCode: getRegionCode(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        countries: getCountryDataForLocale(i18n.getLocale()),
        selectedRegion: getComposerSelectedRegion(state),
      };
    case ComposerStep.ChooseGroupMembers:
      return {
        mode: LeftPaneMode.ChooseGroupMembers,
        candidateContacts: getFilteredCandidateContactsForNewGroup(state),
        groupSizeRecommendedLimit: getGroupSizeRecommendedLimit(),
        groupSizeHardLimit: getGroupSizeHardLimit(),
        isShowingRecommendedGroupSizeModal:
          getRecommendedGroupSizeModalState(state) ===
          OneTimeModalState.Showing,
        isShowingMaximumGroupSizeModal:
          getMaximumGroupSizeModalState(state) === OneTimeModalState.Showing,
        ourE164: getMe(state).e164,
        ourUsername: getMe(state).username,
        regionCode: getRegionCode(state),
        searchTerm: getComposerConversationSearchTerm(state),
        selectedContacts: getComposeSelectedContacts(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.SetGroupMetadata:
      return {
        mode: LeftPaneMode.SetGroupMetadata,
        groupAvatar: getComposeGroupAvatar(state),
        groupName: getComposeGroupName(state),
        groupExpireTimer: getComposeGroupExpireTimer(state),
        hasError: hasGroupCreationError(state),
        isCreating: isCreatingGroup(state),
        isEditingAvatar: isEditingAvatar(state),
        selectedContacts: getComposeSelectedContacts(state),
        userAvatarData: getComposeAvatarData(state),
      };
    default:
      throw missingCaseError(composerStep);
  }
};

function preloadConversation(conversationId: string): void {
  drop(
    window.ConversationController.get(conversationId)?.preloadNewestMessages()
  );
}

export const SmartLeftPane = memo(function SmartLeftPane({
  containerWidthBreakpoint,
  isTabActive,
  navTabsCollapsed,
}: NavTabPanelProps) {
  const backupMediaDownloadProgress = useSelector(getBackupMediaDownloadProgress);
  const challengeStatus = useSelector(getChallengeStatus);
  const crashReportCount = useSelector(getCrashReportCount);
  const hasNetworkDialog = useSelector(getHasNetworkDialog);
  const i18n = useSelector(getIntl);
  const isMacOS = useSelector(getIsMacOS);
  const isUpdateDialogVisible = useSelector(isUpdateDialogVisible);
  const isUpdateDownloaded = useSelector(getIsUpdateDownloaded);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const regionCode = useSelector(getRegionCode);
  const theme = useSelector(getTheme);
  const unsupportedOSDialogType = useSelector(isOSUnsupported);
  const usernameLinkCorrupted = useSelector(getUsernameLinkCorrupted);
  const usernameCorrupted = useSelector(getUsernameCorrupted);
  const conversations = useSelector(getConversations);
  const unreadCount = getUnreadCount(conversations);
  const backupMediaDownloadProgress = useSelector(
    getBackupMediaDownloadProgress
  );
  const {
    blockConversation,
    clearGroupCreationError,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    composeDeleteAvatarFromDisk,
    composeReplaceAvatar,
    composeSaveAvatarToDisk,
    createGroup,
    removeConversation,
    setComposeGroupAvatar,
    setComposeGroupExpireTimer,
    setComposeGroupName,
    setComposeSearchTerm,
    setComposeSelectedRegion,
    setIsFetchingUUID,
    showArchivedConversations,
    showChooseGroupMembers,
    showConversation,
    showFindByPhoneNumber,
    showFindByUsername,
    showInbox,
    startComposing,
    startSettingGroupMetadata,
    toggleComposeEditingAvatar,
    toggleConversationInChooseMembers,
  } = useConversationsActions();
  const {
    clearConversationSearch,
    clearSearchQuery,
    endConversationSearch,
    endSearch,
    searchInConversation,
    startSearch,
    updateSearchTerm,
    updateFilterByUnread,
  } = useSearchActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { openUsernameReservationModal } = useUsernameActions();
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();
  const { setChallengeStatus } = useNetworkActions();
  const { showUserNotFoundModal, toggleProfileEditor } =
    useGlobalModalActions();

  let hasExpiredDialog = false;
  let unsupportedOSDialogType: 'error' | 'warning' | undefined;
  if (hasAppExpired) {
    if (hasUnsupportedOS) {
      unsupportedOSDialogType = 'error';
    } else {
      hasExpiredDialog = true;
    }
  } else if (hasUnsupportedOS) {
    unsupportedOSDialogType = 'warning';
  }

  const hasRelinkDialog = !isRegistrationDone();

  const renderToastManager =
    composerStep == null && !showArchived && !hasSearchQuery
      ? renderToastManagerWithMegaphone
      : renderToastManagerWithoutMegaphone;

  const targetedMessageId = targetedMessage?.id;

  return (
    <>
      {hasExpiredDialog && (
        <DialogExpiredBuild
          containerWidthBreakpoint={containerWidthBreakpoint}
          i18n={i18n}
          isPrimary={isTabActive}
        />
      )}
      {unsupportedOSDialogType && (
        <SmartUnsupportedOSDialog
          containerWidthBreakpoint={containerWidthBreakpoint}
          type={unsupportedOSDialogType}
        />
      )}
      <LeftPane
        unreadCount={unreadCount}
        backupMediaDownloadProgress={backupMediaDownloadProgress}
        cancelBackupMediaDownload={cancelBackupMediaDownload}
        containerWidthBreakpoint={containerWidthBreakpoint}
        dismissBackupMediaDownloadBanner={dismissBackupMediaDownloadBanner}
        hasFailedStorySends={hasFailedStorySends}
        hasPendingUpdate={hasPendingUpdate}
        i18n={i18n}
        isTabActive={isTabActive}
        modeSpecificProps={modeSpecificProps}
        navTabsCollapsed={navTabsCollapsed}
        otherTabsUnreadStats={otherTabsUnreadStats}
        pauseBackupMediaDownload={pauseBackupMediaDownload}
        preferredWidthFromStorage={preferredLeftPaneWidth}
        resumeBackupMediaDownload={resumeBackupMediaDownload}
        selectedConversationId={selectedConversationId}
        showConversation={showConversation}
        targetedMessage={targetedMessage}
        theme={theme}
      toggleComposeEditingAvatar={toggleComposeEditingAvatar}
      toggleConversationInChooseMembers={toggleConversationInChooseMembers}
      toggleNavTabsCollapse={toggleNavTabsCollapse}
      toggleProfileEditor={toggleProfileEditor}
      unsupportedOSDialogType={unsupportedOSDialogType}
      updateSearchTerm={updateSearchTerm}
      usernameCorrupted={usernameCorrupted}
      usernameLinkCorrupted={usernameLinkCorrupted}
      updateFilterByUnread={updateFilterByUnread}
    />
  );
});
