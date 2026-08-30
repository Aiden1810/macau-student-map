import type {ShopCategoryKey} from '../../types/shop';

const CATEGORY_VALUES = new Set<ShopCategoryKey>([
  'all',
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

export type DiscoveryUrlState = {
  query: string;
  category: ShopCategoryKey;
  tags: string[];
};

export function parseDiscoveryUrlState(search: string | URLSearchParams): DiscoveryUrlState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const rawCategory = params.get('category');
  const category = rawCategory && CATEGORY_VALUES.has(rawCategory as ShopCategoryKey)
    ? (rawCategory as ShopCategoryKey)
    : 'all';
  const tags = Array.from(
    new Set(
      (params.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);

  return {query: (params.get('q') ?? '').slice(0, 200), category, tags};
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
