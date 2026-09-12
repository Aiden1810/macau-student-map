import {findTaxonomyTag, resolveTagAlias, type PlaceCategorySlug, type TaxonomyTag} from './taxonomy';
import {resolvePriceDisplay} from '../utils/price';

export const PRIMARY_TAG_SLUGS: Readonly<Record<PlaceCategorySlug, readonly string[]>> = {
  food: ['chinese-cuisine', 'portuguese-cuisine', 'cha-chaan-teng', 'hot-pot', 'western-cuisine', 'japanese-cuisine', 'korean-cuisine', 'barbecue', 'snack', 'fast-food', 'southeast-asian-cuisine', 'coffee', 'milk-tea', 'fruit-tea', 'bread', 'dessert', 'cake', 'burger', 'fried-chicken'],
  shopping: ['clothing', 'electronics', 'supermarket'],
  entertainment: ['karaoke', 'cinema', 'board-games', 'bar', 'murder-mystery'],
  service: ['printing', 'hair-salon', 'repair-service']
};

export type LaunchCategoryKey = 'food' | 'hair-salon' | 'bar' | 'tabletop';
export const LAUNCH_CATEGORIES: readonly {key: LaunchCategoryKey; label: string; category: PlaceCategorySlug; tagSlugs: readonly string[]}[] = [
  {key: 'food', label: '饭店', category: 'food', tagSlugs: PRIMARY_TAG_SLUGS.food},
  {key: 'hair-salon', label: '理发', category: 'service', tagSlugs: ['hair-salon']},
  {key: 'bar', label: '酒吧', category: 'entertainment', tagSlugs: ['bar']},
  {key: 'tabletop', label: '桌游／剧本杀', category: 'entertainment', tagSlugs: ['board-games', 'murder-mystery']}
];

export function isLaunchCategory(value: string): value is LaunchCategoryKey {
  return LAUNCH_CATEGORIES.some(item => item.key === value);
}

export function isPrimaryTag(tag: TaxonomyTag): boolean {
  return ['category', 'cuisine', 'product'].includes(tag.kind);
}

export function getLaunchTagOptions(key: LaunchCategoryKey): TaxonomyTag[] {
  return LAUNCH_CATEGORIES.find(item => item.key === key)!.tagSlugs
    .map(slug => findTaxonomyTag(slug)).filter((tag): tag is TaxonomyTag => tag !== null);
}

/** Changing the entry keeps scene/facility tags, never an incompatible primary type. */
export function selectLaunchCategory(key: LaunchCategoryKey, currentTagIds: readonly string[]) {
  const definition = LAUNCH_CATEGORIES.find(item => item.key === key)!;
  const tagIds = currentTagIds.filter(id => {
    const tag = findTaxonomyTag(id);
    return tag && (!isPrimaryTag(tag) || definition.tagSlugs.includes(tag.slug));
  });
  if (definition.tagSlugs.length === 1) tagIds.push(findTaxonomyTag(definition.tagSlugs[0])!.id);
  return {category: definition.category, tagIds: Array.from(new Set(tagIds))};
}

export type PlaceTypeInput = {category?: string | null; tags: readonly string[]; mainCategory?: string | null; subTags?: readonly string[]};
export type PlaceIconKey = 'restaurant' | 'scissors' | 'wine' | 'dice' | 'mystery' | 'shop' | 'service' | 'entertainment' | 'pin';
export type PlacePresentation = {icon: PlaceIconKey; label: string; launch: LaunchCategoryKey | null; color: string};

export function getPlacePresentation(place: PlaceTypeInput): PlacePresentation {
  const slugs = new Set([...place.tags, ...(place.subTags ?? []), ...(place.mainCategory ? [place.mainCategory] : [])]
    .flatMap(value => {const tag = findTaxonomyTag(value); return tag ? [tag.slug] : resolveTagAlias(value).map(item => item.slug);}));
  // Fixed priority, independent of tag order. A mystery venue is not automatically a board-game venue.
  if (slugs.has('hair-salon')) return {icon: 'scissors', label: '理发', launch: 'hair-salon', color: '#0f766e'};
  if (slugs.has('bar')) return {icon: 'wine', label: '酒吧', launch: 'bar', color: '#854d0e'};
  if (slugs.has('murder-mystery')) return {icon: 'mystery', label: slugs.has('board-games') ? '桌游／剧本杀' : '剧本杀', launch: 'tabletop', color: '#6b21a8'};
  if (slugs.has('board-games')) return {icon: 'dice', label: '桌游', launch: 'tabletop', color: '#1d4ed8'};
  if (place.category === 'food' || place.category === 'drink' || PRIMARY_TAG_SLUGS.food.some(slug => slugs.has(slug))) return {icon: 'restaurant', label: '饭店', launch: 'food', color: '#166534'};
  if (place.category === 'shopping') return {icon: 'shop', label: '购物', launch: null, color: '#475569'};
  if (place.category === 'service') return {icon: 'service', label: '生活服务', launch: null, color: '#475569'};
  if (place.category === 'entertainment') return {icon: 'entertainment', label: '娱乐', launch: null, color: '#475569'};
  return {icon: 'pin', label: '地点', launch: null, color: '#475569'};
}

export function matchesLaunchCategory(place: PlaceTypeInput, key: string): boolean {
  return getPlacePresentation(place).launch === key;
}

export function formatPlacePrice(place: PlaceTypeInput & {pricePerPerson?: number | null}): string {
  const price = resolvePriceDisplay(place.pricePerPerson);
  if (price.kind === 'none') return '消费待补充';
  if (price.kind === 'free') return '免费';
  return getPlacePresentation(place).launch === 'food' ? `人均 MOP ${price.value}` : `消费参考 MOP ${price.value}/人次`;
}
