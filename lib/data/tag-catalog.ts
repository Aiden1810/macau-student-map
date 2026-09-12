/** Do not let approval silently discard tags absent from the deployed catalog. */
export async function checkActiveTagCatalog(
  tagIds: readonly string[],
  loadActiveTags: () => PromiseLike<{data: {id: string}[] | null; error: {message: string} | null}>
): Promise<boolean> {
  try {
    const result = await loadActiveTags();
    if (result.error || !result.data) return false;
    const available = new Set(result.data.map(tag => tag.id));
    return tagIds.length > 0 && tagIds.every(id => available.has(id));
  } catch {
    return false;
  }
}

export type SubmissionTagCatalogStatus = 'ready' | 'not-found' | 'unavailable';

/** Re-check tags at moderation time because a tag may be removed after submission. */
export async function checkSubmissionTagCatalog(
  loadSubmission: () => PromiseLike<{
    data: {tag_ids: unknown} | null;
    error: {message: string} | null;
  }>,
  loadActiveTags: (tagIds: readonly string[]) => PromiseLike<{
    data: {id: string}[] | null;
    error: {message: string} | null;
  }>
): Promise<SubmissionTagCatalogStatus> {
  try {
    const submission = await loadSubmission();
    if (submission.error) return 'unavailable';
    if (!submission.data) return 'not-found';
    const tagIds = submission.data.tag_ids;
    if (!Array.isArray(tagIds) || tagIds.length === 0 || tagIds.some(id => typeof id !== 'string')) {
      return 'unavailable';
    }
    return await checkActiveTagCatalog(tagIds, () => loadActiveTags(tagIds)) ? 'ready' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
