import {describe, expect, it} from 'vitest';
import {filterRecommendedPlaces} from '../../../lib/search/recommendation-filters';
import {mapSingleShop} from '../../../lib/mappers/shop';
import type {Shop} from '../../../types/shop';

const now = Date.parse('2026-10-19T10:00:00Z');
const day = 86_400_000;
const shop = (id: string, overrides: Partial<Shop> = {}): Shop => ({
  id, name: id, address: '', imageUrls: [], type: '餐饮', category: 'food',
  coordinates: [113.5, 22.2], hasCoordinates: true, studentDiscount: null,
  tags: [], features: [], shopType: '全部', ratingLabel: '暂无评分', rating: 0,
  reviews: 0, recommendStatus: 'neutral', status: 'verified', ...overrides
});
const ids = (selected: string[], shops: Shop[]) => filterRecommendedPlaces(selected, shops, now).map(place => place.id);

describe('recommendation filters', () => {
  it.each([
    {review_count: 30, total_sum: 143},
    {rating_count: 30, total_sum: 143},
    {reviews: 30, rating: 143 / 30}
  ])('does not round a legacy average up across a score threshold: %j', metrics => {
    const mapped = mapSingleShop({id: 'borderline', name: '边界店', ...metrics});
    expect(ids(['封神之作'], [mapped])).toEqual([]);
    expect(ids(['强烈推荐'], [mapped])).toEqual(['borderline']);
    expect(mapped.ratingLabel).toBe('强烈推荐');
  });
  it('does not promote an actual 4.26 average to the 4.3 threshold', () => {
    const mapped = mapSingleShop({id: 'below', name: '边界店', total_sum: 213, review_count: 50});
    expect(ids(['强烈推荐'], [mapped])).toEqual([]);
  });
  it('uses actual score and at least five reviews rather than a supplied label', () => {
    const places = [
      shop('legendary', {rating: 4.8, reviews: 5}),
      shop('recommended', {rating: 4.3, reviews: 5}),
      shop('below', {rating: 4.29, reviews: 20}),
      shop('too-few', {rating: 5, reviews: 4, ratingLabel: '封神之作'}),
      shop('invalid', {rating: Infinity, reviews: 10}),
      shop('invalid-count', {rating: 5, reviews: NaN})
    ];
    expect(ids(['封神之作'], places)).toEqual(['legendary']);
    expect(ids(['强烈推荐'], places)).toEqual(['recommended']);
  });

  it('includes unreviewed food at the budget boundary and excludes unknown prices and non-food', () => {
    const places = [
      shop('thirty', {pricePerPerson: 30}), shop('cheap', {pricePerPerson: 1}),
      shop('over', {pricePerPerson: 30.01}), shop('unknown'),
      shop('null', {pricePerPerson: null}), shop('zero', {pricePerPerson: 0}),
      shop('negative', {pricePerPerson: -1}), shop('invalid', {pricePerPerson: NaN}),
      shop('printing', {category: 'service', type: '服务', tags: ['打印影印'], pricePerPerson: 10})
    ];
    expect(ids(['budget-30'], places)).toEqual(['thirty', 'cheap']);
  });

  it('uses first publication in a rolling seven-day window including boundaries', () => {
    const places = [
      shop('boundary', {publishedAt: new Date(now - 7 * day).toISOString()}),
      shop('now', {publishedAt: new Date(now).toISOString()}),
      shop('old', {publishedAt: new Date(now - 7 * day - 1).toISOString()}),
      shop('future', {publishedAt: new Date(now + 1).toISOString()}),
      shop('missing'), shop('null', {publishedAt: null}), shop('invalid', {publishedAt: 'invalid'})
    ];
    expect(ids(['recent-7-days'], places)).toEqual(['boundary', 'now']);
  });

  it('combines all recommendation criteria without requiring a high score first', () => {
    const places = [shop('ordinary'), shop('budget', {pricePerPerson: 25}),
      shop('recent', {publishedAt: new Date(now - day).toISOString()}),
      shop('rated', {rating: 4.9, reviews: 8})];
    expect(ids([], places)).toEqual(['budget', 'recent', 'rated']);
    expect(ids(['budget-30', '封神之作'], places)).toEqual(['budget', 'rated']);
    expect(ids(['unknown'], places)).toEqual([]);
    expect(places.map(place => place.id)).toEqual(['ordinary', 'budget', 'recent', 'rated']);
  });
});
