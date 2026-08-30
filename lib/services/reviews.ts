import {reviewInputSchema, type ReviewInput} from '../domain/review';

export function prepareReviewUpsert(input: ReviewInput, placeId: string, userId: string) {
  const review = reviewInputSchema.parse(input);
  return {
    place_id: placeId,
    user_id: userId,
    rating: review.rating,
    content: review.content,
    status: 'published' as const
  };
}
export function assertReviewOwner(review: {userId: string}, userId: string): void {
  if (review.userId !== userId) {
    throw new Error('Only the review owner may change this review.');
  }
}
