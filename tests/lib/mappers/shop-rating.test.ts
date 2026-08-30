import {describe, expect, it} from 'vitest';
import {mapSingleShop} from '../../../lib/mappers/shop';

describe('legacy shop confidence labels', () => {
  it('downgrades a legendary label when the review sample is too small', () => {
    expect(
      mapSingleShop({id: 'one', name: '一条五星', rating: 5, review_count: 1, rating_label: '封神之作'})
        .ratingLabel
    ).toBe('还行吧');
  });

  it('allows legendary only after five reviews with an average of at least 4.8', () => {
    expect(
      mapSingleShop({id: 'five', name: '高置信好店', rating: 4.9, review_count: 5, rating_label: '封神之作'})
        .ratingLabel
    ).toBe('封神之作');
  });
});
