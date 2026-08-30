import {describe, expect, it} from 'vitest';
import {
  assertOwnedObjectPath,
  createSubmissionObjectPath,
  validateImageUpload
} from '../../../lib/storage/object-path';

const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = '22222222-2222-4222-8222-222222222222';
const objectId = '33333333-3333-4333-8333-333333333333';

describe('submission media object paths', () => {
  it('creates a server-owned path from trusted identifiers and MIME type', () => {
    expect(createSubmissionObjectPath(userId, submissionId, 'image/webp', objectId)).toBe(
      `${userId}/${submissionId}/${objectId}.webp`
    );
  });

  it('rejects executable MIME types, empty files, and files over 10 MiB', () => {
    expect(() => validateImageUpload({type: 'text/html', size: 100})).toThrow(/type/i);
    expect(() => validateImageUpload({type: 'image/png', size: 0})).toThrow(/empty/i);
    expect(() => validateImageUpload({type: 'image/jpeg', size: 10 * 1024 * 1024 + 1})).toThrow(/large/i);
  });

  it('rejects traversal and a path belonging to a different user', () => {
    expect(() => assertOwnedObjectPath('../secret.webp', userId, submissionId)).toThrow();
    expect(() =>
      assertOwnedObjectPath(`other-user/${submissionId}/${objectId}.webp`, userId, submissionId)
    ).toThrow(/owner/i);
  });

  it('accepts only the exact owned path shape', () => {
    const path = `${userId}/${submissionId}/${objectId}.jpg`;
    expect(assertOwnedObjectPath(path, userId, submissionId)).toBe(path);
  });
});
