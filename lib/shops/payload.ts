import {ShopRegion, ShopRatingLabel} from '@/types/shop';
import {dedupeTrimmedList, deriveRatingLabelFromScore, deriveRegionFromCoordinates} from '@/lib/shops/normalization';
import {findTagById, migrateLegacyTagsForSubmission} from '@/lib/tags/schema';

export type ShopCategory = 'food' | 'drink' | 'vibe' | 'deal';
export type ShopType = '正餐' | '快餐小吃' | '饮品甜点' | '服务';

export type ShopPayloadBuildInput = {
  name: string;
  nameEn?: string | null;
  address?: string | null;
  amapPoiId?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  category: ShopCategory;
  selectedTagIds?: string[];
  selectedPresetTags?: string[]; // 兼容旧调用
  customTags?: string[];
  ratingScore?: number | null;
  ratingLabel?: ShopRatingLabel | null;
  shopType?: ShopType | null;
  imageUrls?: string[];
  reviewText?: string | null;
  reviewTextEn?: string | null;
  tagsEn?: string[];
  features?: string[];
  status?: 'pending' | 'verified' | 'rejected';
  pricePerPerson?: number | null;
  region?: ShopRegion | null;
};

function deriveShopTypeFromCategory(category: ShopCategory): ShopType {
  if (category === 'food') return '正餐';
  if (category === 'drink') return '饮品甜点';
  return '服务';
}

export function buildNormalizedShopPayload(input: ShopPayloadBuildInput): Record<string, unknown> {
  const name = input.name.trim();

  const normalizedLegacy = migrateLegacyTagsForSubmission(input.selectedPresetTags ?? []);
  const normalizedTagIds = dedupeTrimmedList([...(input.selectedTagIds ?? []), ...normalizedLegacy.tagIds], 8);
  const canonicalTagNames = normalizedTagIds
    .map((tagId) => findTagById(tagId)?.tag_name)
    .filter((x): x is string => Boolean(x));

  const customTags = dedupeTrimmedList(input.customTags ?? [], 5);
  const mergedDisplayTags = dedupeTrimmedList([...canonicalTagNames, ...customTags], 8);
  const englishTags = dedupeTrimmedList(input.tagsEn ?? [], 8);
  const reviewText = input.reviewText?.trim() ?? '';
  const reviewTextEn = input.reviewTextEn?.trim() ?? '';

  const longitude = Number.isFinite(input.longitude) ? Number(input.longitude) : null;
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : null;

  const normalizedMainCategory = canonicalTagNames[0] ?? mergedDisplayTags[0] ?? null;
  const normalizedSubTags = mergedDisplayTags.filter((tag) => tag !== normalizedMainCategory);

  const ratingScore = typeof input.ratingScore === 'number' && Number.isFinite(input.ratingScore)
    ? Math.max(0, Math.min(5, Number(input.ratingScore)))
    : null;

  const normalizedRatingLabel = input.ratingLabel ?? (ratingScore !== null ? deriveRatingLabelFromScore(ratingScore) : '暂无评分');

  const normalizedRegion = input.region ?? deriveRegionFromCoordinates(longitude, latitude);
  const shopType = input.shopType ?? deriveShopTypeFromCategory(input.category);

  return {
    name,
    name_i18n: {
      'zh-CN': name,
      en: input.nameEn?.trim() || name
    },
    address: input.address?.trim() || null,
    amap_poi_id: input.amapPoiId?.trim() || null,
    longitude,
    latitude,
    category: input.category,
    shop_type: shopType,
    rating_label: normalizedRatingLabel,
    rating: ratingScore,
    total_sum: ratingScore,
    rating_count: ratingScore !== null ? 1 : 0,
    review_count: reviewText ? 1 : 0,
    features: dedupeTrimmedList(input.features ?? []),

    // 新体系字段（统一契约）
    tag_ids: normalizedTagIds,
    canonical_tags: canonicalTagNames,

    // 兼容旧字段（先保留，避免一次性破坏）
    tags: mergedDisplayTags,
    tags_i18n: {
      'zh-CN': mergedDisplayTags,
      en: englishTags.length > 0 ? englishTags : mergedDisplayTags
    },

    main_category: normalizedMainCategory,
    sub_tags: normalizedSubTags,
    image_urls: dedupeTrimmedList(input.imageUrls ?? []),
    review_text: reviewText || null,
    review_text_i18n: {
      'zh-CN': reviewText,
      en: reviewTextEn || reviewText
    },
    status: input.status ?? 'pending',
    price_per_person: input.pricePerPerson ?? null,
    region: normalizedRegion
  };
}
