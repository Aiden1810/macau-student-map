import {describe, expect, it} from 'vitest';
import {buildNormalizedShopPayload} from '../../../lib/shops/payload';

describe('new shop rating payload', () => {
  it('sends a non-null total for an unrated new shop without inventing a rating', () => {
    const payload = buildNormalizedShopPayload({name: '测试理发店', category: 'service', selectedPresetTags: ['理发'], status: 'verified'});
    expect(payload).toMatchObject({rating: null, total_sum: 0, rating_count: 0, rating_label: '暂无评分'});
  });

  it('preserves an explicitly supplied score', () => {
    const payload = buildNormalizedShopPayload({name: '测试店', category: 'food', ratingScore: 4.5});
    expect(payload).toMatchObject({rating: 4.5, total_sum: 4.5, rating_count: 1});
  });
});
