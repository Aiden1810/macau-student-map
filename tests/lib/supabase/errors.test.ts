import {describe, expect, it} from 'vitest';
import {isMissingRelationError} from '../../../lib/supabase/errors';

describe('isMissingRelationError', () => {
  it('recognizes PostgREST schema-cache and PostgreSQL missing-relation errors', () => {
    expect(isMissingRelationError({code: 'PGRST205', message: 'table missing'})).toBe(true);
    expect(isMissingRelationError({code: '42P01', message: 'relation missing'})).toBe(true);
    expect(
      isMissingRelationError({message: "Could not find the table 'public.search_events' in the schema cache"})
    ).toBe(true);
  });

  it('does not hide unrelated operational failures', () => {
    expect(isMissingRelationError({code: '42501', message: 'permission denied'})).toBe(false);
    expect(isMissingRelationError(null)).toBe(false);
  });
});
