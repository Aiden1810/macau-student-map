import {describe, expect, it} from 'vitest';
import {mapCanonicalPlaceToShop} from '../../../lib/mappers/canonical-shop';

describe('mapCanonicalPlaceToShop', () => {
  it('keeps non-food categories and confidence-aware rating labels', () => {
    expect(
      mapCanonicalPlaceToShop({
        id: 'place-1',
        name: '城大影印中心',
        address: '氹仔',
        category_slug: 'service',
        region: 'taipa',
        longitude: 113.55,
        latitude: 22.16,
        price_per_person: 10,
        rating_average: 5,
        review_count: 1,
        status: 'published',
        legacy_image_urls: [],
        place_tags: [{tags: {id: 'tag-1', slug: 'printing', label_zh_mo: '打印影印'}}],
        place_media: []
      })
    ).toMatchObject({
      id: 'place-1',
      name: '城大影印中心',
      category: 'service',
      type: '服务',
      shopType: '服务',
      rating: 5,
      reviews: 1,
      ratingLabel: '还行吧',
      tags: ['打印影印']
    });
  });
});
