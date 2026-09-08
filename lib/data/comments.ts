import type {Comment} from '../../types/shop';

export const COMMENTS_LOAD_ERROR = '评论加载失败，请稍后再试';

export type ReviewRow = {
  id: string;
  placeId: string;
  content: string | null;
  rating: number;
  createdAt: string;
};

export type ReviewsLoaderResult = {
  ok: boolean;
  rows: ReviewRow[];
  errorMessage: string | null;
};

export type ReviewsLoader = (shopId: string) => Promise<ReviewsLoaderResult>;

export function normalizeComments(rows: ReviewRow[] | undefined): Comment[] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    shopId: String(row.placeId),
    content: String(row.content ?? ''),
    rating: Number(row.rating ?? 0) as 1 | 2 | 3 | 4 | 5,
    createdAt: String(row.createdAt)
  }));
}

/**
 * Load a place's published reviews, guarding against network rejections. A
 * transport failure or a non-ok payload both resolve to a stable user-facing
 * error instead of leaving the UI stuck in a loading state or throwing.
 */
export async function loadComments(
  shopId: string,
  loadReviews: ReviewsLoader
): Promise<{error: string | null; items: Comment[]}> {
  let result: ReviewsLoaderResult;
  try {
    result = await loadReviews(shopId);
  } catch {
    return {error: COMMENTS_LOAD_ERROR, items: []};
  }

  if (!result.ok) {
    return {error: result.errorMessage || COMMENTS_LOAD_ERROR, items: []};
  }

  return {error: null, items: normalizeComments(result.rows)};
}