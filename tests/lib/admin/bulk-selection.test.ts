import {describe, expect, it} from 'vitest';
import {getSelectedBulkPlaces, summarizeBulkResults} from '../../../lib/admin/bulk-place-selection';

describe('bulk selection and results', () => {
  it('never operates on invisible or missing ids and keeps displayed order', () => {
    const places = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
    expect(getSelectedBulkPlaces(['hidden', 'c', 'b', 'b'], places)).toEqual([{id: 'b'}, {id: 'c'}]);
  });
  it('keeps changed, already-matching and failed outcomes separate', () => {
    expect(summarizeBulkResults([{id: 'a', outcome: 'updated'}, {id: 'b', outcome: 'unchanged'},
      {id: 'c', outcome: 'failed', code: 'CONFLICT', message: '刷新'}])).toEqual({updated: 1, unchanged: 1, failed: 1});
  });
});
