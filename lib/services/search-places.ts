import type {PlaceSearchMatch} from '../domain/place';
import type {PlaceSearchRequest} from '../domain/search';
import {
  findTaxonomyTag,
  groupSelectedTags,
  normalizeSearchText,
  resolveTagAlias,
  type PlaceCategorySlug,
  type TagKind
} from '../domain/taxonomy';

export type CompatibilityPlace = {
  id: string;
  name: string;
  address?: string | null;
  category?: string | null;
  region?: string | null;
  tags?: readonly string[];
  mainCategory?: string | null;
  subTags?: readonly string[];
  rating?: number | null;
  reviews?: number | null;
  pricePerPerson?: number | null;
};

export type CompatibilitySearchHit<T extends CompatibilityPlace> = {
  item: T;
  score: number;
  matchedBy: PlaceSearchMatch[];
};

const LEGACY_CATEGORY_MAP: Readonly<Record<string, PlaceCategorySlug>> = {
  food: 'food',
  drink: 'food',
  vibe: 'food',
  deal: 'food',
  餐饮: 'food',
  餐飲: 'food',
  服务: 'service',
  服務: 'service',
  shopping: 'shopping',
  entertainment: 'entertainment',
  service: 'service'
};

const LEGACY_REGION_MAP: Readonly<Record<string, string>> = {
  澳门半岛: 'macau-peninsula',
  澳門半島: 'macau-peninsula',
  氹仔岛: 'taipa',
  氹仔島: 'taipa',
  路环岛: 'coloane',
  路環島: 'coloane',
  横琴区: 'hengqin',
  橫琴區: 'hengqin',
  香洲区: 'zhuhai',
  香洲區: 'zhuhai',
  其它: 'other'
};

function canonicalCategory(category: string | null | undefined): PlaceCategorySlug | null {
  if (!category) return null;
  return LEGACY_CATEGORY_MAP[category] ?? null;
}

function canonicalRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  return LEGACY_REGION_MAP[region] ?? region;
}

function tagSlugsFromText(value: string): string[] {
  const wholeMatches = resolveTagAlias(value);
  const segmentMatches = value
    .split(/[\/／,，、|]+/)
    .flatMap((segment) => resolveTagAlias(segment));

  return Array.from(new Set([...wholeMatches, ...segmentMatches].map((tag) => tag.slug)));
}

function itemTagSlugs(item: CompatibilityPlace): Set<string> {
  const textTags = [item.mainCategory ?? '', ...(item.tags ?? []), ...(item.subTags ?? [])].filter(Boolean);
  return new Set(textTags.flatMap(tagSlugsFromText));
}

function selectedGroups(tagIds: readonly string[]): Partial<Record<TagKind, string[]>> {
  const canonicalIdentifiers = tagIds
    .map((idOrSlug) => findTaxonomyTag(idOrSlug)?.slug ?? idOrSlug);
  return groupSelectedTags(canonicalIdentifiers);
}

function matchesSelectedTagGroups(itemSlugs: Set<string>, tagIds: readonly string[]): boolean {
  const groups = selectedGroups(tagIds);
  return Object.values(groups).every((slugs) => slugs.some((slug) => itemSlugs.has(slug)));
}

function confidenceScore(item: CompatibilityPlace): number {
  const average = typeof item.rating === 'number' && Number.isFinite(item.rating) ? item.rating : 0;
  const count = typeof item.reviews === 'number' && Number.isFinite(item.reviews) ? Math.max(0, item.reviews) : 0;
  if (average <= 0 || count <= 0) return 0;
  return (count / (count + 5)) * average + (5 / (count + 5)) * 4;
}

function queryMatch<T extends CompatibilityPlace>(
  request: PlaceSearchRequest,
  item: T,
  slugs: Set<string>
): CompatibilitySearchHit<T> | null {
  const query = request.query;
  if (!query) {
    return {item, score: confidenceScore(item), matchedBy: ['filter_only']};
  }

  const name = normalizeSearchText(item.name);
  const address = normalizeSearchText(item.address ?? '');
  const rawTagText = [item.mainCategory ?? '', ...(item.tags ?? []), ...(item.subTags ?? [])]
    .map(normalizeSearchText)
    .join(' ');
  const queryTagSlugs = new Set(resolveTagAlias(query).map((tag) => tag.slug));
  const hasTagAliasMatch = Array.from(queryTagSlugs).some((slug) => slugs.has(slug));
  const matchedBy: PlaceSearchMatch[] = [];
  let score = 0;

  if (name === query) {
    score = 100;
    matchedBy.push('name_exact');
  } else if (name.startsWith(query)) {
    score = 80;
    matchedBy.push('name_prefix');
  } else if (name.includes(query)) {
    score = 65;
    matchedBy.push('name_contains');
  }

  if (hasTagAliasMatch) {
    score = Math.max(score, 60);
    matchedBy.push('tag_alias');
  }

  if (address.includes(query)) {
    score = Math.max(score, 30);
    matchedBy.push('region');
  }

  if (rawTagText.includes(query) && !hasTagAliasMatch) {
    score = Math.max(score, 20);
    matchedBy.push('full_text');
  }

  if (matchedBy.length === 0) return null;
  return {item, score: score + confidenceScore(item), matchedBy: Array.from(new Set(matchedBy))};
}

export function rankCompatibilityPlaces<T extends CompatibilityPlace>(
  request: PlaceSearchRequest,
  items: readonly T[]
): Array<CompatibilitySearchHit<T>> {
  const filtered = items.filter((item) => {
    const category = canonicalCategory(item.category);
    if (request.category && category !== request.category) return false;
    if (request.region && canonicalRegion(item.region) !== request.region) return false;
    if (
      request.priceMax !== null &&
      (typeof item.pricePerPerson !== 'number' || item.pricePerPerson > request.priceMax)
    ) return false;
    if (
      request.minRating !== null &&
      (typeof item.rating !== 'number' || item.rating < request.minRating)
    ) return false;

    return matchesSelectedTagGroups(itemTagSlugs(item), request.tagIds);
  });

  return filtered
    .map((item) => queryMatch(request, item, itemTagSlugs(item)))
    .filter((hit): hit is CompatibilitySearchHit<T> => hit !== null)
    .sort((left, right) => {
      if (request.sort === 'rating') {
        return confidenceScore(right.item) - confidenceScore(left.item) || right.score - left.score;
      }
      if (request.sort === 'newest' || request.sort === 'distance') {
        return right.score - left.score;
      }
      return right.score - left.score;
    });
}
