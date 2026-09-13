import {describe, expect, it} from 'vitest';
import {selectSecondaryFilter} from '../../../lib/search/filter-selection';
import {filterBySelectedFacet} from '../../../lib/search/legacy-filters';

describe('secondary filter selection', () => {
  it('switches directly from Macau Peninsula to Xiangzhou and filters only the new region', () => {
    const next = selectSecondaryFilter('region', ['澳门半岛'], '香洲区');
    expect(next).toEqual(['香洲区']);
    expect(filterBySelectedFacet(next, [
      {id: 'macau', region: '澳门半岛', tags: []},
      {id: 'zhuhai', region: '香洲区', tags: []}
    ], 'region').map(place => place.id)).toEqual(['zhuhai']);
  });

  it('clears a selected region on a second click', () => {
    expect(selectSecondaryFilter('region', ['香洲区'], '香洲区')).toEqual([]);
  });

  it('replaces a food choice and lets the user reset to all food', () => {
    expect(selectSecondaryFilter('food', ['hot-pot'], 'barbecue')).toEqual(['barbecue']);
    expect(selectSecondaryFilter('food', ['barbecue'], null)).toEqual([]);
  });

  it('preserves independent multi-select scenarios', () => {
    expect(selectSecondaryFilter('vibe', ['group-gathering'], 'photo-friendly'))
      .toEqual(['group-gathering', 'photo-friendly']);
  });
});
