import {describe, expect, it} from 'vitest';
import {checkActiveTagCatalog, checkSubmissionTagCatalog} from '../../../lib/data/tag-catalog';

describe('deployment-safe submission tags', () => {
  it('blocks a new tag before its database migration is applied', async () => {
    expect(await checkActiveTagCatalog(['new-id'], async () => ({data: [], error: null}))).toBe(false);
  });
  it('allows all requested active tags, including repeated selections', async () => {
    expect(await checkActiveTagCatalog(['a', 'a', 'b'], async () => ({data: [{id: 'a'}, {id: 'b'}], error: null}))).toBe(true);
  });
  it('fails closed on query errors or network rejection', async () => {
    expect(await checkActiveTagCatalog(['a'], async () => ({data: [{id: 'a'}], error: {message: 'offline'}}))).toBe(false);
    expect(await checkActiveTagCatalog(['a'], async () => {throw new Error('offline');})).toBe(false);
  });
});

describe('moderation-safe submission tags', () => {
  it('requires every pending submission tag to still be active before moderation', async () => {
    const result = await checkSubmissionTagCatalog(
      async () => ({data: {tag_ids: ['bar-id', 'late-night-id']}, error: null}),
      async () => ({data: [{id: 'bar-id'}], error: null})
    );
    expect(result).toBe('unavailable');
  });

  it('returns ready only when the submission and all active tags exist', async () => {
    const result = await checkSubmissionTagCatalog(
      async () => ({data: {tag_ids: ['bar-id']}, error: null}),
      async () => ({data: [{id: 'bar-id'}], error: null})
    );
    expect(result).toBe('ready');
  });

  it('distinguishes a missing submission from a catalog failure', async () => {
    expect(await checkSubmissionTagCatalog(
      async () => ({data: null, error: null}),
      async () => ({data: [], error: null})
    )).toBe('not-found');
    expect(await checkSubmissionTagCatalog(
      async () => ({data: {tag_ids: ['bar-id']}, error: {message: 'offline'}}),
      async () => ({data: [], error: null})
    )).toBe('unavailable');
  });
});
