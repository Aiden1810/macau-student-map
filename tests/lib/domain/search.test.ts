import {describe, expect, it} from 'vitest';
import {normalizePlaceSearchRequest} from '../../../lib/domain/search';

describe('normalizePlaceSearchRequest', () => {
  it('normalizes query text and applies stable defaults', () => {
    expect(normalizePlaceSearchRequest({query: '  漢堡   套餐  '})).toMatchObject({
      query: '汉堡 套餐',
      page: 1,
      pageSize: 20,
      sort: 'relevance',
      openNow: false
    });
  });

  it('keeps all unique selected tags instead of only the first tag', () => {
    expect(normalizePlaceSearchRequest({tagIds: ['burger', 'fried-chicken', 'burger', '']})).toMatchObject({
      tagIds: ['burger', 'fried-chicken']
    });
  });

  it('accepts comma-separated URL tag values', () => {
    expect(normalizePlaceSearchRequest({tagIds: 'burger,fried-chicken,burger'}).tagIds).toEqual([
      'burger',
      'fried-chicken'
    ]);
  });

  it('bounds pagination and numeric filters', () => {
    expect(
      normalizePlaceSearchRequest({page: -8, pageSize: 500, minRating: 9, priceMax: -2})
    ).toMatchObject({
      page: 1,
      pageSize: 50,
      minRating: null,
      priceMax: null
    });
  });

  it('rejects unknown categories and sort values', () => {
    expect(normalizePlaceSearchRequest({category: 'deal', sort: 'popular'})).toMatchObject({
      category: null,
      sort: 'relevance'
    });
  });

  it('keeps only valid geographic centers', () => {
    expect(
      normalizePlaceSearchRequest({center: {longitude: 113.55, latitude: 22.2}}).center
    ).toEqual({longitude: 113.55, latitude: 22.2});

    expect(
      normalizePlaceSearchRequest({center: {longitude: Number.NaN, latitude: 22.2}}).center
    ).toBeNull();

    expect(normalizePlaceSearchRequest({center: {longitude: 200, latitude: 22.2}}).center).toBeNull();
  });

  it('treats only explicit true values as open-now filtering', () => {
    expect(normalizePlaceSearchRequest({openNow: 'true'}).openNow).toBe(true);
    expect(normalizePlaceSearchRequest({openNow: '1'}).openNow).toBe(true);
    expect(normalizePlaceSearchRequest({openNow: 'false'}).openNow).toBe(false);
  });
});
