import {CanonicalTagOption, findTagByName, getCanonicalTagsForAdminAndSubmit} from '@/lib/tags/schema';

export type MatchedLevel = 'exact' | 'synonym' | 'expanded' | 'similar_category';

export type SynonymHit = {
  tag_id: string;
  tag_name: string;
  weight: number;
  matched_term: string;
};

export type SearchResponseBuildInput<T> = {
  query: string;
  matchedLevel: MatchedLevel;
  items: T[];
  matchedTags: Array<{tag_id: string; tag_name: string; score_source: number}>;
  fallbackUsed: boolean;
};

const SYNONYM_DICT: Record<string, Array<{tagName: string; weight: number}>> = {
  面: [
    {tagName: '中餐', weight: 0.7},
    {tagName: '日料', weight: 0.3}
  ],
  面条: [{tagName: '中餐', weight: 0.9}],
  拉面: [
    {tagName: '日料', weight: 0.7},
    {tagName: '中餐', weight: 0.3}
  ],
  寿司: [{tagName: '日料', weight: 0.95}],
  韩式: [{tagName: '韩餐', weight: 0.9}],
  港式: [{tagName: '茶餐厅', weight: 0.9}],
  葡餐: [{tagName: '葡国菜', weight: 0.95}],
  奶盖: [{tagName: '奶茶', weight: 0.8}],
  coffee: [{tagName: '咖啡', weight: 0.95}],
  cafe: [{tagName: '咖啡', weight: 0.9}],
  dessert: [{tagName: '甜品', weight: 0.9}],
  bakery: [{tagName: '面包', weight: 0.8}],
  cake: [{tagName: '蛋糕', weight: 0.9}]
};

const EXPAND_DICT: Record<string, string[]> = {
  面: ['面条', '面食', '汤面', '拌面', '捞面', '拉面'],
  茶: ['奶茶', '果茶', '下午茶'],
  咖啡: ['拿铁', '美式', '手冲'],
  甜: ['甜品', '蛋糕', '面包']
};

const SIMILAR_CATEGORY_MAP: Record<string, string[]> = {
  中餐: ['小吃', '快餐'],
  日料: ['韩餐', '烤肉'],
  奶茶: ['果茶', '咖啡'],
  甜品: ['蛋糕', '面包']
};

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchExact<T extends {name: string; tags: string[]; mainCategory?: string | null; subTags?: string[]}>(
  normalizedQuery: string,
  items: T[]
): T[] {
  if (!normalizedQuery) return [];
  return items.filter((item) => {
    const pool = [item.name, ...(item.tags ?? []), item.mainCategory ?? '', ...((item.subTags ?? []) as string[])].join(' ').toLowerCase();
    return pool.includes(normalizedQuery);
  });
}

export function matchSynonymsWithWeights(query: string): SynonymHit[] {
  const normalized = normalizeQuery(query);
  const entries = SYNONYM_DICT[normalized] ?? [];

  return entries
    .map((entry) => {
      const tag = findTagByName(entry.tagName);
      if (!tag) return null;
      return {
        tag_id: tag.tag_id,
        tag_name: tag.tag_name,
        weight: entry.weight,
        matched_term: normalized
      };
    })
    .filter((x): x is SynonymHit => x !== null)
    .sort((a, b) => b.weight - a.weight);
}

export function expandQueryTerms(query: string): string[] {
  const normalized = normalizeQuery(query);
  return EXPAND_DICT[normalized] ?? [];
}

export function fallbackToSimilarCategories(tagNames: string[]): CanonicalTagOption[] {
  const fallbackNames = Array.from(new Set(tagNames.flatMap((tag) => SIMILAR_CATEGORY_MAP[tag] ?? [])));
  return fallbackNames
    .map((name) => findTagByName(name))
    .filter((x): x is CanonicalTagOption => x !== null);
}

export function buildSearchResponse<T>(input: SearchResponseBuildInput<T>) {
  return {
    query: input.query,
    matched_level: input.matchedLevel,
    fallback_message: input.fallbackUsed ? '已为你展示相近结果' : null,
    matched_tags: input.matchedTags,
    canonical_tags_for_form: getCanonicalTagsForAdminAndSubmit(),
    items: input.items
  };
}

export async function logSearchQuery(params: {
  query: string;
  hit: boolean;
  matchedLevel: MatchedLevel;
  resultCount: number;
  userAnonId?: string | null;
  logger?: (payload: {
    query: string;
    normalized_query: string;
    hit: boolean;
    matched_level: MatchedLevel;
    result_count: number;
    user_anon_id: string | null;
    searched_at: string;
  }) => Promise<void>;
}) {
  if (!params.logger) return;

  await params.logger({
    query: params.query,
    normalized_query: normalizeQuery(params.query),
    hit: params.hit,
    matched_level: params.matchedLevel,
    result_count: params.resultCount,
    user_anon_id: params.userAnonId ?? null,
    searched_at: new Date().toISOString()
  });
}
