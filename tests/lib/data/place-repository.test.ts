import {describe, expect, it} from 'vitest';
import {mapPlaceRow} from '../../../lib/data/place-repository';

const completeRow = {
  id: 'place-1',
  name: '校園漢堡研究所',
  name_en: 'Campus Burger Lab',
  address: '澳門氹仔大學大馬路',
  category_slug: 'food',
  region: 'taipa',
  longitude: 113.5567,
  latitude: 22.1634,
  price_per_person: 58,
  rating_average: 4.5,
  review_count: 8,
  confidence_score: 4.3077,
  status: 'published',
  published_at: '2026-08-29T08:00:00.000Z',
  created_at: '2026-08-28T08:00:00.000Z',
  updated_at: '2026-08-29T08:00:00.000Z',
  place_tags: [
    {
      tags: {
        id: 'tag-burger',
        slug: 'burger',
        kind: 'product',
        label_zh_mo: '漢堡'
      }
    }
  ],
  place_media: [
    {
      id: 'media-2',
      public_url: 'https://example.com/second.webp',
      alt_text: null,
      sort_order: 2
    },
    {
      id: 'media-1',
      public_url: 'https://example.com/cover.webp',
      alt_text: '漢堡店門面',
      sort_order: 1
    }
  ],
  legacy_image_urls: []
};

describe('mapPlaceRow', () => {
  it('maps a complete Supabase row to the canonical Place contract', () => {
    expect(mapPlaceRow(completeRow)).toEqual({
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
      media: [
        {
          id: 'media-1',
          url: 'https://example.com/cover.webp',
          altText: '漢堡店門面',
          sortOrder: 1
        },
        {
          id: 'media-2',
          url: 'https://example.com/second.webp',
          altText: null,
          sortOrder: 2
        }
      ],
      status: 'published',
      publishedAt: '2026-08-29T08:00:00.000Z',
      createdAt: '2026-08-28T08:00:00.000Z',
      updatedAt: '2026-08-29T08:00:00.000Z'
    });
  });

  it('keeps unrated places unrated and adapts legacy image URLs', () => {
    expect(
      mapPlaceRow({
        ...completeRow,
        id: 'place-2',
        rating_average: null,
        review_count: 0,
        confidence_score: null,
        place_media: [],
        legacy_image_urls: ['https://example.com/legacy.jpg']
      })
    ).toMatchObject({
      ratingAverage: null,
      reviewCount: 0,
      confidenceScore: null,
      media: [
        {
          id: 'legacy:place-2:0',
          url: 'https://example.com/legacy.jpg',
          altText: null,
          sortOrder: 0
        }
      ]
    });
  });

  it('rejects rows that violate canonical category or coordinate contracts', () => {
    expect(() => mapPlaceRow({...completeRow, category_slug: 'deal'})).toThrow(/category/i);
    expect(() => mapPlaceRow({...completeRow, longitude: 999})).toThrow(/longitude/i);
  });
});
