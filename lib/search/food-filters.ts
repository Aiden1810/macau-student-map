import {normalizeSearchText} from '../domain/taxonomy';
import {filterBySelectedFacet, type LegacyFilterablePlace} from './legacy-filters';

// These narrower types have no dedicated database tag yet. Match explicit manual
// tags only; a generic Chinese-cuisine/fast-food tag must not imply noodles/roast meat.
export const FOOD_KEYWORD_FILTERS = [
  {value: 'food-noodles', labelKey: 'noodles', labelZhCN: '粉面', matchKeywords: ['粉面', '粉麵', '面食', '麵食', '牛肉面', '牛肉麵', '米粉', '河粉', '拉面', '拉麵', '云吞面', '雲吞麵', '粉面 / 粥店', '粉麵 / 粥店']},
  {value: 'food-siu-mei', labelKey: 'siuMei', labelZhCN: '烧腊', matchKeywords: ['烧腊', '燒臘', '烧味', '燒味', '叉烧', '叉燒', '烧鸭', '燒鴨', '烧鹅', '燒鵝', '烧腊 / 快餐', '燒臘 / 快餐']}
] as const;

type FoodFilterablePlace = LegacyFilterablePlace & {filterTags?: readonly string[]; mainCategory?: string | null; subTags?: readonly string[]};

export function filterFoodPlaces<T extends FoodFilterablePlace>(selected: readonly string[], places: readonly T[]): T[] {
  if (selected.length === 0) return [...places];
  const keywordFilters = FOOD_KEYWORD_FILTERS.filter(filter => selected.includes(filter.value));
  const tagValues = selected.filter(value => !FOOD_KEYWORD_FILTERS.some(filter => filter.value === value));
  const tagMatches = new Set(tagValues.length > 0 ? filterBySelectedFacet(tagValues, places, 'food') : []);
  const keywords = new Set(keywordFilters.flatMap(filter => filter.matchKeywords.map(normalizeSearchText)));
  return places.filter(place => tagMatches.has(place) ||
    [...place.tags, ...(place.filterTags ?? []), ...(place.subTags ?? []), ...(place.mainCategory ? [place.mainCategory] : [])]
      .some(tag => keywords.has(normalizeSearchText(tag))));
}
