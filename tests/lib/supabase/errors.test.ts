import {describe, expect, it} from 'vitest';
import {isMissingRelationError} from '../../../lib/supabase/errors';

describe('isMissingRelationError', () => {
  it('recognizes PostgREST schema-cache and PostgreSQL missing-relation errors', () => {
    expect(isMissingRelationError({code: 'PGRST205', message: 'table missing'})).toBe(true);
    expect(isMissingRelationError({code: '42P01', message: 'relation missing'})).toBe(true);
    expect(isMissingRelationError({code: 'PGRST200', message: 'schema cache stale'})).toBe(true);
    expect(
      isMissingRelationError({message: "Could not find the table 'public.search_events' in the schema cache"})
    ).toBe(true);
    expect(isMissingRelationError({message: 'relation "places" does not exist'})).toBe(true);
    expect(
      isMissingRelationError({
        message: 'could not find a relationship between "places" and "place_tags" in the schema cache'
      })
    ).toBe(true);
  });

  it('does not hide unrelated operational failures', () => {
    expect(isMissingRelationError({code: '42501', message: 'permission denied for table places'})).toBe(false);
    expect(isMissingRelationError({code: '401', message: 'unauthenticated'})).toBe(false);
    expect(isMissingRelationError({code: '403', message: 'forbidden'})).toBe(false);
    expect(isMissingRelationError({code: '22P02', message: 'invalid input syntax for type uuid'})).toBe(false);
    expect(isMissingRelationError({message: 'connection refused'})).toBe(false);
    expect(isMissingRelationError(null)).toBe(false);
  });
});
