import {describe, expect, it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {markTransferredSourceForCleanup, transferApprovedSubmissionMedia} from '../../../lib/services/media';

const ownerId = '22222222-2222-4222-8222-222222222222';
const submissionId = '10000000-0000-4000-8000-000000000001';
const placeId = '10000000-0000-4000-8000-000000000005';
const sourceMediaId = '70000000-0000-4000-8000-000000000001';
const privatePath = `${ownerId}/${submissionId}/${sourceMediaId}.jpg`;

// Only the external database/storage boundary is replaced; the recovery logic is real.
function mediaStore(sourceId = sourceMediaId) {
  const rows: Record<string, unknown>[] = [{id: sourceId, submission_id: submissionId, place_id: null,
    bucket_id: 'submission-media', storage_path: privatePath, mime_type: 'image/jpeg',
    byte_size: 10, uploaded_by: ownerId, sort_order: 0, lifecycle_status: 'uploaded'}];
  let failCleanup = true;
  let failUpload = false;
  let failInsert = false;
  let failPublicCleanup = false;
  const storageCalls: string[] = [];
  const objects = new Set([`submission-media:${privatePath}`]);
  const submissions = [{id: submissionId, published_place_id: placeId, submitted_by: ownerId}];
  const client = {
    from: (table: string) => {
      const tableRows: Record<string, unknown>[] = table === 'place_submissions' ? submissions : rows;
      const filters: [string, unknown][] = [];
      let operation = 'select'; let changes: Record<string, unknown> = {};
      const run = () => {
        const selected = tableRows.filter(row => filters.every(([key, value]) => row[key] === value));
        if (operation === 'update') selected.forEach(row => Object.assign(row, changes));
        if (operation === 'insert') {
          if (failInsert) return {data: null, error: {message: 'metadata unavailable'}};
          const row = {id: 'public-copy', ...changes}; rows.push(row); return {data: row, error: null};
        }
        if (operation === 'delete') selected.forEach(row => rows.splice(rows.indexOf(row), 1));
        return {data: selected, error: null};
      };
      const query = {
        select: () => query, eq: (key: string, value: unknown) => {filters.push([key, value]); return query;},
        update: (value: Record<string, unknown>) => {operation = 'update'; changes = value; return query;},
        insert: (value: Record<string, unknown>) => {operation = 'insert'; changes = value; return query;},
        delete: () => {operation = 'delete'; return query;},
        maybeSingle: async () => {const result = run(); return {...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data};},
        single: async () => {const result = run(); return {...result, data: Array.isArray(result.data) ? result.data[0] : result.data};},
        then: (resolve: (value: ReturnType<typeof run>) => unknown) => Promise.resolve(run()).then(resolve)
      };
      return query;
    },
    storage: {from: (bucket: string) => ({
      download: async () => {storageCalls.push('download'); return {data: new Blob(['image']), error: null};},
      upload: async (path: string, _file: Blob, options: {upsert?: boolean}) => {
        storageCalls.push('upload');
        if (failUpload) return {error: {message: 'upload unavailable'}};
        if (objects.has(`${bucket}:${path}`) && !options.upsert) return {error: {message: 'object already exists'}};
        objects.add(`${bucket}:${path}`); return {error: null};
      },
      remove: async (paths: string[]) => {
        storageCalls.push('remove');
        if (bucket === 'submission-media' && failCleanup) return {error: {message: 'cleanup unavailable'}};
        if (bucket === 'place-media' && failPublicCleanup) return {error: {message: 'public cleanup unavailable'}};
        paths.forEach(path => objects.delete(`${bucket}:${path}`)); return {error: null};
      }
    })}
  } as unknown as SupabaseClient;
  return {client, rows, objects, submissions, storageCalls, allowCleanup: () => {failCleanup = false;}, failUpload: () => {failUpload = true;},
    interruptAssociation: () => {failInsert = true; failPublicCleanup = true;},
    allowAssociation: () => {failInsert = false; failPublicCleanup = false;}};
}

describe('approved image transfer recovery', () => {
  it.each(['uploaded', 'cleanup_pending'])('does not access a forged private path during %s', async lifecycle => {
    const store = mediaStore();
    store.rows[0].storage_path = `33333333-3333-4333-8333-333333333333/${submissionId}/${sourceMediaId}.jpg`;
    store.rows[0].lifecycle_status = lifecycle;
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    expect(store.storageCalls).toEqual([]);
    expect(store.rows).toHaveLength(1);
  });

  it('does not publish an attachment whose uploader differs from the submission owner', async () => {
    const store = mediaStore();
    store.submissions[0].submitted_by = '33333333-3333-4333-8333-333333333333';
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    expect(store.storageCalls).toEqual([]);
    expect(store.rows).toHaveLength(1);
  });

  it('keeps a recoverable private source after cleanup failure and does not duplicate the public copy on retry', async () => {
    const store = mediaStore();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    expect(store.rows.find(row => row.id === sourceMediaId)).toMatchObject({submission_id: submissionId, bucket_id: 'submission-media'});
    expect(store.rows.filter(row => row.place_id === placeId)).toHaveLength(1);
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toEqual([]);
    expect(store.rows.filter(row => row.place_id === placeId)).toHaveLength(1);
    expect(store.rows.find(row => row.id === sourceMediaId)).toBeUndefined();
    expect([...store.objects].filter(path => path.startsWith('submission-media:'))).toEqual([]);
  });
  it('keeps the private original when the public upload fails', async () => {
    const store = mediaStore(); store.failUpload();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({submission_id: submissionId, lifecycle_status: 'uploaded'});
  });
  it('recovers an uploaded object whose metadata and compensating deletion both failed', async () => {
    const store = mediaStore(); store.interruptAssociation();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    expect(store.objects.has(`place-media:${placeId}/${sourceMediaId}.jpg`)).toBe(true);
    expect(store.rows.filter(row => row.place_id === placeId)).toHaveLength(0);
    store.allowAssociation(); store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toEqual([]);
    expect(store.rows.filter(row => row.place_id === placeId)).toHaveLength(1);
    expect(store.rows.find(row => row.id === sourceMediaId)).toBeUndefined();
  });
  it('only cleans the private source after an administrator removes its published copy', async () => {
    const store = mediaStore();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toHaveLength(1);
    store.rows.splice(store.rows.findIndex(row => row.id === 'public-copy'), 1);
    store.objects.delete(`place-media:${placeId}/${sourceMediaId}.jpg`);
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toEqual([]);
    expect(store.rows).toHaveLength(0);
    expect(store.objects.size).toBe(0);
  });
  it('marks a transferred source before deletion even if the transfer has not marked it yet', async () => {
    const sourceId = '70000000-0000-4000-8000-000000000001';
    const store = mediaStore(sourceId);
    await markTransferredSourceForCleanup(store.client, placeId, `${placeId}/${sourceId}.jpg`);
    expect(store.rows[0].lifecycle_status).toBe('cleanup_pending');
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, submissionId, placeId)).toEqual([]);
    expect(store.objects.size).toBe(0);
  });
  it('does not cancel a source belonging to a different published place', async () => {
    const sourceId = '70000000-0000-4000-8000-000000000001';
    const store = mediaStore(sourceId);
    await markTransferredSourceForCleanup(store.client, 'different-place', `different-place/${sourceId}.jpg`);
    expect(store.rows[0].lifecycle_status).toBe('uploaded');
  });
});
