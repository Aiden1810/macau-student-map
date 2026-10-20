import {revalidateTag} from 'next/cache';

export const PUBLIC_PLACES_CACHE_TAG = 'public-places';
export const PUBLIC_PLACES_CACHE_SECONDS = 30;

/** Invalidate even after uncertain/partial writes; never report a committed write as failed just because cache clearing failed. */
export async function runPlaceMutation<T>(operation: () => PromiseLike<T>): Promise<T> {
  try {
    return await operation();
  } finally {
    try {revalidateTag(PUBLIC_PLACES_CACHE_TAG);} catch {
      console.error('Public place cache invalidation failed; timed revalidation will retry.');
    }
  }
}
