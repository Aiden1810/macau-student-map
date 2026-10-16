import {describe, expect, it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {markTransferredSourceForCleanup, transferApprovedSubmissionMedia} from '../../../lib/services/media';

// Only the external database/storage boundary is replaced; the recovery logic is real.
function mediaStore(sourceId = 'source-image') {
  const rows: Record<string, unknown>[] = [{id: sourceId, submission_id: 'submission', place_id: null,
    bucket_id: 'submission-media', storage_path: 'member/submission/photo.jpg', mime_type: 'image/jpeg',
    byte_size: 10, uploaded_by: 'member', sort_order: 0, lifecycle_status: 'uploaded'}];
  let failCleanup = true;
  let failUpload = false;
  let failInsert = false;
  let failPublicCleanup = false;
  const objects = new Set(['submission-media:member/submission/photo.jpg']);
  const submissions = [{id: 'submission', published_place_id: 'place'}];
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
      download: async () => ({data: new Blob(['image']), error: null}),
      upload: async (path: string, _file: Blob, options: {upsert?: boolean}) => {
        if (failUpload) return {error: {message: 'upload unavailable'}};
        if (objects.has(`${bucket}:${path}`) && !options.upsert) return {error: {message: 'object already exists'}};
        objects.add(`${bucket}:${path}`); return {error: null};
      },
      remove: async (paths: string[]) => {
        if (bucket === 'submission-media' && failCleanup) return {error: {message: 'cleanup unavailable'}};
        if (bucket === 'place-media' && failPublicCleanup) return {error: {message: 'public cleanup unavailable'}};
        paths.forEach(path => objects.delete(`${bucket}:${path}`)); return {error: null};
      }
    })}
  } as unknown as SupabaseClient;
  return {client, rows, objects, allowCleanup: () => {failCleanup = false;}, failUpload: () => {failUpload = true;},
    interruptAssociation: () => {failInsert = true; failPublicCleanup = true;},
    allowAssociation: () => {failInsert = false; failPublicCleanup = false;}};
}

describe('approved image transfer recovery', () => {
  it('keeps a recoverable private source after cleanup failure and does not duplicate the public copy on retry', async () => {
    const store = mediaStore();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toHaveLength(1);
    expect(store.rows.find(row => row.id === 'source-image')).toMatchObject({submission_id: 'submission', bucket_id: 'submission-media'});
    expect(store.rows.filter(row => row.place_id === 'place')).toHaveLength(1);
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toEqual([]);
    expect(store.rows.filter(row => row.place_id === 'place')).toHaveLength(1);
    expect(store.rows.find(row => row.id === 'source-image')).toBeUndefined();
    expect([...store.objects].filter(path => path.startsWith('submission-media:'))).toEqual([]);
  });
  it('keeps the private original when the public upload fails', async () => {
    const store = mediaStore(); store.failUpload();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toHaveLength(1);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({submission_id: 'submission', lifecycle_status: 'uploaded'});
  });
  it('recovers an uploaded object whose metadata and compensating deletion both failed', async () => {
    const store = mediaStore(); store.interruptAssociation();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toHaveLength(1);
    expect(store.objects.has('place-media:place/source-image.jpg')).toBe(true);
    expect(store.rows.filter(row => row.place_id === 'place')).toHaveLength(0);
    store.allowAssociation(); store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toEqual([]);
    expect(store.rows.filter(row => row.place_id === 'place')).toHaveLength(1);
    expect(store.rows.find(row => row.id === 'source-image')).toBeUndefined();
  });
  it('only cleans the private source after an administrator removes its published copy', async () => {
    const store = mediaStore();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toHaveLength(1);
    store.rows.splice(store.rows.findIndex(row => row.id === 'public-copy'), 1);
    store.objects.delete('place-media:place/source-image.jpg');
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toEqual([]);
    expect(store.rows).toHaveLength(0);
    expect(store.objects.size).toBe(0);
  });
  it('marks a transferred source before deletion even if the transfer has not marked it yet', async () => {
    const sourceId = '70000000-0000-4000-8000-000000000001';
    const store = mediaStore(sourceId);
    await markTransferredSourceForCleanup(store.client, 'place', `place/${sourceId}.jpg`);
    expect(store.rows[0].lifecycle_status).toBe('cleanup_pending');
    store.allowCleanup();
    expect(await transferApprovedSubmissionMedia(store.client, 'submission', 'place')).toEqual([]);
    expect(store.objects.size).toBe(0);
  });
  it('does not cancel a source belonging to a different published place', async () => {
    const sourceId = '70000000-0000-4000-8000-000000000001';
    const store = mediaStore(sourceId);
    await markTransferredSourceForCleanup(store.client, 'different-place', `different-place/${sourceId}.jpg`);
    expect(store.rows[0].lifecycle_status).toBe('uploaded');
  });
});
