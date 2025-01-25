
import { isOlderThan } from './timestamp';

export function shouldShowMediaNotAvailableIcon(
  attachment: AttachmentType,
  timestamp: number
): boolean {
  // Stickers are permanently stored and should never show the icon
  if (attachment.contentType === 'application/x-signal-sticker') {
    return false;
  }

  // Don't show the icon for pending attachments
  if (attachment.pending) {
    return false;
  }

  // Check if the attachment is older than 45 days
  const FORTY_FIVE_DAYS = 45 * 24 * 60 * 60 * 1000;
  if (isOlderThan(timestamp, FORTY_FIVE_DAYS)) {
    return true;
  }

  // Add more conditions here if needed

  return false;
}
