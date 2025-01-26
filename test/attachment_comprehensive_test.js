
// Mock functions
const isAttachmentLocallySaved = (attachment) => Boolean(attachment.path);
const isDownloadable = (attachment) => !attachment.error && !attachment.undownloadable;

function isPermanentlyUndownloadable(attachment) {
  // Stickers are never permanently undownloadable
  if (attachment.isSticker) {
    return false;
  }

  // Local attachments are not permanently undownloadable
  if (isAttachmentLocallySaved(attachment)) {
    return false;
  }

  // Pending attachments are not permanently undownloadable
  if (attachment.pending) {
    return false;
  }

  // Keep the original check for non-downloadable attachments with errors
  return Boolean(!isDownloadable(attachment) && attachment.error);
}

// Test cases
const testCases = [
  { name: 'Sticker', attachment: { isSticker: true, contentType: 'image/webp', size: 1000 }, expected: false },
  { name: 'Local attachment', attachment: { path: '/path/to/local/file.jpg', contentType: 'image/jpeg', size: 2000 }, expected: false },
  { name: 'Pending attachment', attachment: { pending: true, contentType: 'image/png', size: 3000 }, expected: false },
  { name: 'Error attachment', attachment: { error: true, contentType: 'application/octet-stream', size: 4000 }, expected: true },
  { name: 'Normal downloadable attachment', attachment: { contentType: 'image/jpeg', size: 5000 }, expected: false },
  { name: 'Undownloadable attachment without error', attachment: { undownloadable: true, contentType: 'image/jpeg', size: 6000 }, expected: false },
  { name: 'Sticker with error', attachment: { isSticker: true, error: true, contentType: 'image/webp', size: 7000 }, expected: false },
  { name: 'Local attachment with error', attachment: { path: '/path/to/file.jpg', error: true, contentType: 'image/jpeg', size: 8000 }, expected: false },
  { name: 'Pending attachment with error', attachment: { pending: true, error: true, contentType: 'image/png', size: 9000 }, expected: false },
  { name: 'Attachment with both path and error', attachment: { path: '/path/to/file.jpg', error: true, undownloadable: true, contentType: 'image/jpeg', size: 10000 }, expected: false },
];

let passedTests = 0;
let failedTests = 0;

testCases.forEach(({ name, attachment, expected }) => {
  const result = isPermanentlyUndownloadable(attachment);
  if (result === expected) {
    console.log(`✅ ${name}: Passed`);
    passedTests++;
  } else {
    console.log(`❌ ${name}: Failed (Expected ${expected}, got ${result})`);
    failedTests++;
  }
});

console.log(`
Test Results: ${passedTests} passed, ${failedTests} failed`);
