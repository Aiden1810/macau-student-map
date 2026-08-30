type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function isMissingRelationError(error: DatabaseErrorLike | null | undefined): boolean {
  if (!error) return false;

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table|relation .* does not exist/i.test(error.message ?? '')
  );
}
