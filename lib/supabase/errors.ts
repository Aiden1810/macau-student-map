type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/**
 * Detect errors that mean the canonical `places` schema (or one of its
 * relationships) is not queryable yet: the table does not exist, the
 * PostgREST schema cache does not know it, or a joined relationship is missing
 * from the schema cache.
 *
 * Authentication (401), permission (403/42501) and ordinary query failures are
 * intentionally not classified here.
 */
export function isMissingRelationError(error: DatabaseErrorLike | null | undefined): boolean {
  if (!error) return false;

  const message = error.message ?? '';

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST200' ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /could not find a relationship .* in the schema cache/i.test(message)
  );
}
