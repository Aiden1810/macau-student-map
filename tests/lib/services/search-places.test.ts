import {describe, expect, it} from 'vitest';
import {rankCompatibilityPlaces} from '../../../lib/services/search-places';
import {normalizePlaceSearchRequest} from '../../../lib/domain/search';

const places = [
  {
    id: 'burger-taipa',
    name: '大學漢堡店',
    address: '氹仔大學大馬路',
    category: 'food',
    region: 'taipa',
    tags: ['汉堡 / 炸鸡', '学生证折扣'],
    rating: 4.4,
    reviews: 18,
    pricePerPerson: 55
  },
  {
    id: 'chicken-taipa',
    name: '酥脆炸雞',
    address: '氹仔地堡街',
    category: 'food',
    region: 'taipa',
    tags: ['炸鸡'],
    rating: 4.2,
    reviews: 30,
    pricePerPerson: 45
  },
  {
    id: 'sushi-peninsula',
    name: '海風壽司',
    address: '澳門半島',
    category: 'food',
    region: 'macau-peninsula',
    tags: ['日料'],
    rating: 4.8,
    reviews: 3,
    pricePerPerson: 120
  },
  {
    id: 'bakery',
    name: 'Andrew Bakery',
    address: '路環',
    category: 'food',
    region: 'coloane',
    tags: ['面包', '甜品'],
    rating: 4.7,
    reviews: 50,
    pricePerPerson: 35
  }
] as const;

describe('rankCompatibilityPlaces', () => {
  it.each(['汉堡', '漢堡', 'burger'])('finds burger places for %s with an explanation', (query) => {
    const result = rankCompatibilityPlaces(normalizePlaceSearchRequest({query}), places);
    expect(result.map((item) => item.item.id)).toEqual(['burger-taipa']);
    expect(result[0].matchedBy).toContain('tag_alias');
  });

  it('finds Japanese food through a product synonym', () => {
    const result = rankCompatibilityPlaces(normalizePlaceSearchRequest({query: '寿司'}), places);
    expect(result[0]).toMatchObject({item: {id: 'sushi-peninsula'}});
  });

  it('returns an honest empty result for an unknown query', () => {
    const result = rankCompatibilityPlaces(
      normalizePlaceSearchRequest({query: '量子火锅飞船'}),
      places
    );
    expect(result).toEqual([]);
  });

  it('uses OR within a tag kind and AND across region filters', () => {
    const result = rankCompatibilityPlaces(
      normalizePlaceSearchRequest({
        tagIds: ['burger', 'fried-chicken'],
        region: 'taipa'
      }),
      places
    );
    expect(result.map((item) => item.item.id)).toEqual(['burger-taipa', 'chicken-taipa']);
  });

  it('applies price and rating filters without inventing results', () => {
    const result = rankCompatibilityPlaces(
      normalizePlaceSearchRequest({priceMax: 50, minRating: 4.3}),
      places
    );
    expect(result.map((item) => item.item.id)).toEqual(['bakery']);
  });
});
