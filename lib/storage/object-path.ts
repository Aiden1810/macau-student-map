export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
} as const;

export type AllowedImageMime = keyof typeof IMAGE_MIME_EXTENSIONS;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateImageUpload(file: {type: string; size: number}): AllowedImageMime {
  if (!(file.type in IMAGE_MIME_EXTENSIONS)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('The image file is empty.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('The image file is too large. Maximum size is 10 MiB.');
  }
  return file.type as AllowedImageMime;
}
function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${field} must be a UUID.`);
  }
}

export function createSubmissionObjectPath(
  userId: string,
  submissionId: string,
  mimeType: AllowedImageMime,
  objectId = crypto.randomUUID()
): string {
  assertUuid(userId, 'userId');
  assertUuid(submissionId, 'submissionId');
  assertUuid(objectId, 'objectId');
  const extension = IMAGE_MIME_EXTENSIONS[mimeType];
  return `${userId}/${submissionId}/${objectId}.${extension}`;
}

export function assertOwnedObjectPath(
  storagePath: string,
  userId: string,
  submissionId: string
): string {
  assertUuid(userId, 'userId');
  assertUuid(submissionId, 'submissionId');
  const escapedUser = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSubmission = submissionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ownedPattern = new RegExp(
    `^${escapedUser}/${escapedSubmission}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`,
    'i'
  );

  if (storagePath.includes('..') || !ownedPattern.test(storagePath)) {
    throw new Error('The object path does not belong to this owner and submission.');
  }
  return storagePath;
}
