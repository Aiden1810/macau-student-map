import {describe, expect, it} from 'vitest';
import {buildNormalizedShopPayload} from '../../../lib/shops/payload';
import {mapSingleShop} from '../../../lib/mappers/shop';
import {getPlacePresentation, matchesLaunchCategory} from '../../../lib/domain/place-types';
import {filterBySelectedFacet} from '../../../lib/search/legacy-filters';

describe('admin payload to public place', () => {
  it.each([
    ['service', ['理髮'], 'hair-salon', 'scissors'],
    ['entertainment', ['酒吧'], 'bar', 'wine'],
    ['entertainment', ['桌遊'], 'tabletop', 'dice'],
    ['entertainment', ['劇本殺'], 'tabletop', 'mystery']
  ])('round trips %s %j into filtering and the map icon', (category, tags, launch, icon) => {
    const payload = buildNormalizedShopPayload({name: '同名店（氹仔分店）', category: category as 'service' | 'entertainment', selectedPresetTags: tags as string[], longitude: 113.556, latitude: 22.163, status: 'verified'});
    const place = mapSingleShop({...payload, id: 'branch-1'});
    expect(place.category).toBe(category);
    expect(place.coordinates).toEqual([113.556, 22.163]);
    expect(matchesLaunchCategory(place, launch)).toBe(true);
    expect(getPlacePresentation(place).icon).toBe(icon);
  });

  it('rejects conflicting primary types instead of publishing a restaurant as a hair salon', () => {
    expect(() => buildNormalizedShopPayload({name: '测试', category: 'food', selectedPresetTags: ['理发']})).toThrow();
  });

  it('keeps unrecognized historical tags when editing and does not silently drop them', () => {
    const payload = buildNormalizedShopPayload({name: '测试', category: 'food', selectedPresetTags: ['中餐', '老板推荐套餐']});
    expect(payload.tags).toContain('老板推荐套餐');
  });

  it('does not mix board games with murder mystery in the secondary filter', () => {
    const places = [{id: 'board', tags: ['桌遊']}, {id: 'mystery', tags: ['劇本殺']}];
    expect(filterBySelectedFacet(['murder-mystery'], places, 'tabletop').map(p => p.id)).toEqual(['mystery']);
  });

  it('rejects too many tags instead of silently losing existing labels', () => {
    expect(() => buildNormalizedShopPayload({
      name: '测试', category: 'food', selectedPresetTags: ['中餐'],
      customTags: Array.from({length: 8}, (_, index) => `历史标签${index}`)
    })).toThrow('最多');
  });
});
