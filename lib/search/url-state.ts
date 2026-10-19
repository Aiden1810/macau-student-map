import type {ShopCategoryKey} from '../../types/shop';
import {resolveTagAlias} from '../domain/taxonomy';

const CATEGORY_VALUES = new Set<ShopCategoryKey>([
  'all',
  'hair-salon',
  'bar',
  'tabletop',
  'food',
  'drink',
  'shopping',
  'entertainment',
  'service',
  'vibe',
  'region',
  'deal',
  'review'
]);

const LEGACY_RECOMMENDATION_VALUES = new Map([
  ['高性价比', 'budget-30'], ['人均30元内', 'budget-30'],
  ['本周新上', 'recent-7-days'], ['本周上新', 'recent-7-days'], ['近7天收录', 'recent-7-days']
]);

export type DiscoveryUrlState = {
  query: string;
  category: ShopCategoryKey;
  tags: string[];
};

function normalizeTagValues(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values.flatMap((value) => {
        const matches = resolveTagAlias(value);
        return matches.length > 0 ? matches.map((tag) => tag.slug) : [value];
      })
    )
  ).slice(0, 20);
}

export function parseDiscoveryUrlState(search: string | URLSearchParams): DiscoveryUrlState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const rawCategory = params.get('category');
  const category = rawCategory && CATEGORY_VALUES.has(rawCategory as ShopCategoryKey)
    ? (rawCategory as ShopCategoryKey)
    : 'all';
  const tags = normalizeTagValues(
    (params.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .map(tag => category === 'review' ? LEGACY_RECOMMENDATION_VALUES.get(tag) ?? tag : tag)
      .filter(Boolean)
  );

  return {query: (params.get('q') ?? '').slice(0, 200), category, tags: category === 'region' ? tags.slice(-1) : tags};
}
export function updateDiscoverySearchParams(
  current: URLSearchParams,
  state: DiscoveryUrlState
): URLSearchParams {
  const next = new URLSearchParams(current);
  const setOrDelete = (key: string, value: string) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete('q', state.query.trim());
  setOrDelete('category', state.category === 'all' ? '' : state.category);
  setOrDelete('tags', state.tags.join(','));
  return next;
}
