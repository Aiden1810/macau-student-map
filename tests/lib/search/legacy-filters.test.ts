import {describe, expect, it} from 'vitest';
import {filterBySelectedFacet} from '../../../lib/search/legacy-filters';

const places = [
  {id: 'burger', tags: ['汉堡 / 炸鸡'], region: '氹仔岛'},
  {id: 'japanese', tags: ['日韩料理'], region: '澳门半岛'},
  {id: 'coffee', tags: ['咖啡'], region: '氹仔岛'}
];

describe('filterBySelectedFacet', () => {
  it('uses OR semantics for multiple tags in the same facet', () => {
    expect(
      filterBySelectedFacet(['汉堡 / 炸鸡', '日韩料理'], places, 'food').map((place) => place.id)
    ).toEqual(['burger', 'japanese']);
  });

  it('uses OR semantics for selected regions', () => {
    expect(
      filterBySelectedFacet(['氹仔岛', '澳门半岛'], places, 'region').map((place) => place.id)
    ).toEqual(['burger', 'japanese', 'coffee']);
  });

  it('returns all items when no secondary filter is selected', () => {
    expect(filterBySelectedFacet([], places, 'food')).toEqual(places);
  });
});
