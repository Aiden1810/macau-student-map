import {L2_TAGS} from '@/components/FilterBar';
import {ShopRegion, ShopRatingLabel} from '@/types/shop';
import {dedupeTrimmedList, deriveRatingLabelFromScore, deriveRegionFromCoordinates} from '@/lib/shops/normalization';

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
  selectedPresetTags?: string[];
  customTags?: string[];
  mainCategoryInput?: string | null;
  ratingScore?: number | null;
  ratingLabel?: ShopRatingLabel | null;
  shopType?: ShopType | null;
  imageUrls?: string[];
  reviewText?: string | null;
  reviewTextEn?: string | null;
  tagsEn?: string[];
  features?: string[];
  studentDiscount?: string | null;
  status?: 'pending' | 'verified' | 'rejected';
  pricePerPerson?: number | null;
  region?: ShopRegion | null;
  signatureDish?: string | null;
  sharpReview?: string | null;
};

function deriveShopTypeFromCategoryAndTags(category: ShopCategory, mergedTags: string[]): ShopType {
  if (category === 'food') {
    const snackTags: string[] = L2_TAGS.food
      .filter((group) => group.groupKey === 'dailyMeals' || group.groupKey === 'streetSnacks')
      .flatMap((group) => group.options.map((option) => option.value));
    const isSnack = mergedTags.some((tag) => snackTags.includes(tag));
    return isSnack ? '快餐小吃' : '正餐';
  }

  if (category === 'drink') {
    return '饮品甜点';
  }

  return '服务';
}

export function buildNormalizedShopPayload(input: ShopPayloadBuildInput): Record<string, unknown> {
  const name = input.name.trim();
  const mergedTags = dedupeTrimmedList([...(input.selectedPresetTags ?? []), ...(input.customTags ?? [])], 5);
  const normalizedPresetTags = dedupeTrimmedList(input.selectedPresetTags ?? []).filter((tag) => mergedTags.includes(tag));
  const normalizedCustomTags = dedupeTrimmedList(input.customTags ?? []).filter((tag) => mergedTags.includes(tag));
  const englishTags = dedupeTrimmedList(input.tagsEn ?? [], 5);
  const reviewText = input.reviewText?.trim() ?? '';
  const reviewTextEn = input.reviewTextEn?.trim() ?? '';

  const longitude = Number.isFinite(input.longitude) ? Number(input.longitude) : null;
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : null;

  const normalizedMainCategory = input.mainCategoryInput?.trim() || normalizedPresetTags[0] || mergedTags[0] || null;
  const normalizedSubTags = mergedTags.filter((tag) => tag !== normalizedMainCategory);

  const ratingScore = typeof input.ratingScore === 'number' && Number.isFinite(input.ratingScore)
    ? Math.max(0, Math.min(5, Number(input.ratingScore)))
    : null;

  const normalizedRatingLabel = input.ratingLabel ?? (ratingScore !== null ? deriveRatingLabelFromScore(ratingScore) : '暂无评分');

  const normalizedRegion =
    input.region ?? deriveRegionFromCoordinates(longitude, latitude);

  const shopType = input.shopType ?? deriveShopTypeFromCategoryAndTags(input.category, mergedTags);

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
    tags: mergedTags,
    tags_i18n: {
      'zh-CN': mergedTags,
      en: englishTags.length > 0 ? englishTags : mergedTags
    },
    main_category: normalizedMainCategory,
    sub_tags: normalizedSubTags.length > 0 ? normalizedSubTags : normalizedCustomTags,
    image_urls: dedupeTrimmedList(input.imageUrls ?? []),
    review_text: reviewText || null,
    review_text_i18n: {
      'zh-CN': reviewText,
      en: reviewTextEn || reviewText
    },
    student_discount: input.studentDiscount?.trim() || null,
    status: input.status ?? 'pending',
    price_per_person: input.pricePerPerson ?? null,
    region: normalizedRegion,
    signature_dish: input.signatureDish?.trim() || null,
    sharp_review: input.sharpReview?.trim() || null
  };
}
