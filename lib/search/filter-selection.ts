import type {ShopCategoryKey} from '../../types/shop';

export function selectSecondaryFilter(
  category: ShopCategoryKey,
  current: readonly string[],
  value: string | null
): string[] {
  if (value === null) return [];
  if (category === 'vibe') {
    return current.includes(value) ? current.filter(item => item !== value) : [...current, value];
  }
  return current[0] === value ? [] : [value];
}
