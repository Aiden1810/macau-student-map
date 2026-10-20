import {describe, expect, it} from 'vitest';
import {mapCanonicalPlaceToShop} from '../../../lib/mappers/canonical-shop';
import {rankCompatibilityPlaces} from '../../../lib/services/search-places';
import {normalizePlaceSearchRequest} from '../../../lib/domain/search';
import {matchesAdminPlaceSearch} from '../../../lib/admin/place-editor';

describe('admin keywords on published places', () => {
  it('finds places by the shared cuisine group, specific cuisine and English aliases', () => {
    const place = {name: '餐厅', nameEn: null, address: null, searchKeywords: [], tagIds: ['00000000-0000-0000-0000-000000000112']};
    expect(matchesAdminPlaceSearch(place, '其他菜系')).toBe(true);
    expect(matchesAdminPlaceSearch(place, 'Indian food')).toBe(true);
    expect(matchesAdminPlaceSearch(place, '东南亚菜')).toBe(false);
  });
  it('makes a manual keyword searchable without inventing a taxonomy tag', () => {
    const place = mapCanonicalPlaceToShop({id: 'example', name: '测试店', address: '氹仔', category_slug: 'food',
      region: 'taipa', longitude: 113.56, latitude: 22.16, price_per_person: null,
      rating_average: null, review_count: 0, status: 'published', legacy_image_urls: [],
      search_keywords_manual: ['好吃', '牛腩招牌']});
    expect(rankCompatibilityPlaces(normalizePlaceSearchRequest({query: '牛腩'}), [place])).toHaveLength(1);
    expect(place.pricePerPerson).toBeNull();
    expect(place.reviews).toBe(0);
  });
});
