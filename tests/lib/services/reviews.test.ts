import {describe, expect, it} from 'vitest';
import {reviewInputSchema} from '../../../lib/domain/review';
import {assertReviewOwner, prepareReviewUpsert} from '../../../lib/services/reviews';

const placeId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

describe('review validation and ownership', () => {
  it('accepts only integer ratings from 1 through 5', () => {
    expect(() => reviewInputSchema.parse({rating: 0, content: null})).toThrow();
    expect(() => reviewInputSchema.parse({rating: 5.5, content: null})).toThrow();
    expect(reviewInputSchema.parse({rating: 5, content: null}).rating).toBe(5);
  });

  it('normalizes optional content and limits its size', () => {
    expect(reviewInputSchema.parse({rating: 4, content: '   '})).toEqual({rating: 4, content: null});
    expect(() => reviewInputSchema.parse({rating: 4, content: 'x'.repeat(3001)})).toThrow();
  });

  it('builds an owner-bound upsert payload without accepting client status or user id', () => {
    expect(prepareReviewUpsert({rating: 4, content: '  清晰、实用  '}, placeId, userId)).toEqual({
      place_id: placeId,
      user_id: userId,
      rating: 4,
      content: '清晰、实用',
      status: 'published'
    });
    expect(() => reviewInputSchema.parse({rating: 4, content: null, status: 'published'})).toThrow();
  });

  it('rejects changes by a non-owner', () => {
    expect(() => assertReviewOwner({userId}, 'another-user')).toThrow(/owner/i);
  });
});
