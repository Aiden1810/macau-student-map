import {describe, expect, it} from 'vitest';
import {mapCanonicalPlaceToShop, mapPlaceToShop} from '../../../lib/mappers/canonical-shop';
import type {Place} from '../../../lib/domain/place';

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    name: '校園漢堡研究所',
    nameEn: 'Campus Burger Lab',
    address: '澳門氹仔大學大馬路',
    category: 'food',
    region: 'taipa',
    longitude: 113.5567,
    latitude: 22.1634,
    pricePerPerson: 58,
    ratingAverage: 4.5,
    reviewCount: 8,
    confidenceScore: 4.3077,
    tags: [{id: 'tag-burger', slug: 'burger', kind: 'product', label: '漢堡'}],
    media: [{id: 'media-1', url: 'https://example.com/cover.webp', altText: null, sortOrder: 1}],
    status: 'published',
    publishedAt: '2026-08-29T08:00:00.000Z',
    createdAt: '2026-08-28T08:00:00.000Z',
    updatedAt: '2026-08-29T08:00:00.000Z',
    ...overrides
  };
}

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

describe('mapPlaceToShop', () => {
  it('maps a canonical Place domain object into the Shop shape the detail page consumes', () => {
    const shop = mapPlaceToShop(makePlace());

    expect(shop).toMatchObject({
      id: 'place-1',
      name: '校園漢堡研究所',
      address: '澳門氹仔大學大馬路',
      category: 'food',
      type: '餐饮',
      coordinates: [113.5567, 22.1634],
      hasCoordinates: true,
      pricePerPerson: 58,
      rating: 4.5,
      reviews: 8,
      region: '氹仔岛',
      status: 'verified',
      tags: ['漢堡'],
      imageUrls: ['https://example.com/cover.webp']
    });
  });

  it('prefers canonical media and ignores legacy image urls when canonical media exists', () => {
    const shop = mapPlaceToShop(
      makePlace({
        media: [
          {id: 'media-1', url: 'https://example.com/cover.webp', altText: null, sortOrder: 1},
          {id: 'legacy:place-1:0', url: 'https://example.com/legacy.jpg', altText: null, sortOrder: 0}
        ]
      })
    );

    expect(shop.imageUrls).toEqual(['https://example.com/cover.webp']);
  });

  it('falls back to legacy image urls when there is no canonical media', () => {
    const shop = mapPlaceToShop(
      makePlace({
        media: [
          {id: 'legacy:place-1:0', url: 'https://example.com/legacy.jpg', altText: null, sortOrder: 0},
          {id: 'legacy:place-1:1', url: 'https://example.com/legacy-2.jpg', altText: null, sortOrder: 1}
        ]
      })
    );

    expect(shop.imageUrls).toEqual([
      'https://example.com/legacy.jpg',
      'https://example.com/legacy-2.jpg'
    ]);
  });

  it('keeps unrated canonical places unrated', () => {
    const shop = mapPlaceToShop(makePlace({ratingAverage: null, reviewCount: 0}));

    expect(shop.rating).toBe(0);
    expect(shop.reviews).toBe(0);
    expect(shop.ratingLabel).toBe('暂无评分');
  });
});
