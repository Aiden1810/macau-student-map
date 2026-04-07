import {
  FILTERABLE_RATING_LABELS,
  RecommendStatus,
  SHOP_DRAWER_TYPES,
  SHOP_FEATURE_OPTIONS,
  Shop,
  ShopCategoryKey,
  ShopDrawerType,
  ShopFeature,
  ShopRatingLabel,
  ShopStatus,
  ShopType
} from '@/types/shop';

const VALID_SHOP_TYPES: ShopType[] = ['餐饮', '服务'];
const VALID_RECOMMEND_STATUS: RecommendStatus[] = ['recommend', 'neutral', 'avoid'];
const VALID_SHOP_STATUS: ShopStatus[] = ['pending', 'verified', 'rejected'];
const VALID_CATEGORY_KEYS: Array<Exclude<ShopCategoryKey, 'all' | 'review'>> = ['food', 'drink', 'vibe', 'deal'];
const VALID_SHOP_DRAWER_TYPES: ShopDrawerType[] = [...SHOP_DRAWER_TYPES];
const VALID_FEATURES: ShopFeature[] = [...SHOP_FEATURE_OPTIONS];
const VALID_RATING_LABELS: ShopRatingLabel[] = [...FILTERABLE_RATING_LABELS, '暂无评分'];
const MACAU_CENTER: [number, number] = [113.5439, 22.1911];
const DEFAULT_SHOP_NAME = '未知店铺 (Unnamed Shop)';
const DEFAULT_SHOP_ADDRESS = '地址信息收录中 (Address pending)';
const DEFAULT_SHOP_IMAGE_URLS: string[] = [];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidShopType(value: unknown): value is ShopType {
  return typeof value === 'string' && VALID_SHOP_TYPES.includes(value as ShopType);
}

function isValidRecommendStatus(value: unknown): value is RecommendStatus {
  return typeof value === 'string' && VALID_RECOMMEND_STATUS.includes(value as RecommendStatus);
}

function pickFirstRecord(input: unknown): Record<string, unknown> | null {
  if (isObject(input)) {
    return input;
  }

  return null;
}

function pickFirstNonEmptyString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function pickRawName(raw: Record<string, unknown>): string {
  const shop = isObject(raw?.shop) ? raw.shop : null;
  return pickFirstNonEmptyString(raw?.name, raw?.shop_name, raw?.title, shop?.name) ?? DEFAULT_SHOP_NAME;
}

function pickRawAddress(raw: Record<string, unknown>): string {
  const shop = isObject(raw?.shop) ? raw.shop : null;
  const amap = isObject(raw?.amap) ? raw.amap : null;

  return (
    pickFirstNonEmptyString(
      raw?.address,
      raw?.full_address,
      raw?.formatted_address,
      shop?.address,
      shop?.full_address,
      amap?.address,
      amap?.formatted_address
    ) ?? DEFAULT_SHOP_ADDRESS
  );
}

function pickRawImageUrls(raw: Record<string, unknown>): string[] {
  const shop = isObject(raw?.shop) ? raw.shop : null;
  const media = isObject(raw?.media) ? raw.media : null;
  const cover = isObject(media?.cover) ? media.cover : null;

  const imageUrlsFromArray = [raw?.image_urls, shop?.image_urls, media?.images].find(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string')
  ) as string[] | undefined;

  if (imageUrlsFromArray && imageUrlsFromArray.length > 0) {
    return imageUrlsFromArray.map((url) => url.trim()).filter(Boolean);
  }

  const single = pickFirstNonEmptyString(
    raw?.image_url,
    raw?.image,
    raw?.cover,
    raw?.photo,
    raw?.thumbnail,
    shop?.image_url,
    shop?.cover,
    media?.image_url,
    cover?.url
  );

  return single ? [single] : DEFAULT_SHOP_IMAGE_URLS;
}

function mapCategoryToShopType(value: unknown): ShopType {
  if (isValidShopType(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return '服务';
  }

  const normalized = value.trim();

  if (!normalized) {
    return '服务';
  }

  if (normalized === '美食') {
    return '餐饮';
  }

  if (['餐饮', '饮食', '食店', '小吃', '咖啡', '茶饮', '饭店', '餐厅'].includes(normalized)) {
    return '餐饮';
  }

  return '服务';
}

function normalizeCategoryKey(value: unknown): Exclude<ShopCategoryKey, 'all' | 'review'> {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALID_CATEGORY_KEYS.includes(normalized as Exclude<ShopCategoryKey, 'all' | 'review'>)) {
      return normalized as Exclude<ShopCategoryKey, 'all' | 'review'>;
    }

    if (['美食', '餐饮'].includes(value.trim())) {
      return 'food';
    }

    if (['饮品', '饮品/甜点', '咖啡', '奶茶'].includes(value.trim())) {
      return 'drink';
    }

    if (['氛围', '场景', '环境'].includes(value.trim())) {
      return 'vibe';
    }

    if (['优惠', '折扣'].includes(value.trim())) {
      return 'deal';
    }
  }

  return 'food';
}

function normalizeShopDrawerType(value: unknown, tags: string[] = [], subTags: string[] = []): ShopDrawerType {
  if (typeof value === 'string' && VALID_SHOP_DRAWER_TYPES.includes(value as ShopDrawerType)) {
    return value as ShopDrawerType;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '餐饮') {
      return '正餐';
    }
  }

  const merged = [...tags, ...subTags].map((item) => item.trim());

  if (merged.includes('正餐')) {
    return '正餐';
  }

  if (merged.includes('快餐小吃')) {
    return '快餐小吃';
  }

  if (merged.includes('饮品甜点') || merged.includes('奶茶') || merged.includes('咖啡') || merged.includes('甜品')) {
    return '饮品甜点';
  }

  if (merged.includes('服务')) {
    return '服务';
  }

  return '全部';
}

function normalizeFeatures(input: unknown): ShopFeature[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item): item is ShopFeature => VALID_FEATURES.includes(item as ShopFeature));
}

function normalizeRatingLabel(value: unknown, score: number): ShopRatingLabel {
  if (typeof value === 'string' && VALID_RATING_LABELS.includes(value as ShopRatingLabel)) {
    return value as ShopRatingLabel;
  }

  if (score >= 5) {
    return '封神之作';
  }

  if (score >= 4) {
    return '强烈推荐';
  }

  if (score >= 3) {
    return '还行吧';
  }

  if (score >= 1) {
    return '建议避雷';
  }

  return '暂无评分';
}

function parseMaybeNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isLikelyRegionalCoordinate(lng: number, lat: number): boolean {
  return lng >= 113 && lng <= 114.2 && lat >= 21.8 && lat <= 22.6;
}

function tryParseCoordinates(input: unknown): [number, number] | null {
  if (Array.isArray(input) && input.length >= 2) {
    const lng = parseMaybeNumber(input[0]);
    const lat = parseMaybeNumber(input[1]);

    if (lng !== null && lat !== null && isLikelyRegionalCoordinate(lng, lat)) {
      return [lng, lat];
    }

    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (trimmed.includes(',')) {
      const [lngRaw, latRaw] = trimmed.split(',');
      const lng = parseMaybeNumber(lngRaw);
      const lat = parseMaybeNumber(latRaw);

      if (lng !== null && lat !== null && isLikelyRegionalCoordinate(lng, lat)) {
        return [lng, lat];
      }

      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return tryParseCoordinates(parsed);
    } catch {
      return null;
    }
  }

  if (isObject(input)) {
    const lng = parseMaybeNumber(input?.lng ?? input?.lon ?? input?.longitude);
    const lat = parseMaybeNumber(input?.lat ?? input?.latitude);

    if (lng !== null && lat !== null && isLikelyRegionalCoordinate(lng, lat)) {
      return [lng, lat];
    }

    return null;
  }

  return null;
}

function normalizeReviewMetrics(
  rating: unknown,
  reviews: unknown,
  reviewCount: unknown,
  totalSum: unknown,
  ratingCount: unknown
): Pick<Shop, 'rating' | 'reviews'> {
  const parsedReviewCount =
    typeof reviewCount === 'number' ? reviewCount : typeof reviewCount === 'string' ? Number(reviewCount) : NaN;

  const safeReviewCount = Number.isFinite(parsedReviewCount) && parsedReviewCount > 0 ? Math.floor(parsedReviewCount) : 0;

  if (safeReviewCount > 0) {
    const parsedSum = typeof totalSum === 'number' ? totalSum : typeof totalSum === 'string' ? Number(totalSum) : 0;

    const safeSum = Number.isFinite(parsedSum) ? parsedSum : 0;
    const average = Number((safeSum / safeReviewCount).toFixed(1));

    return {rating: average, reviews: safeReviewCount};
  }

  const parsedCount =
    typeof ratingCount === 'number' ? ratingCount : typeof ratingCount === 'string' ? Number(ratingCount) : NaN;

  const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.floor(parsedCount) : 0;

  if (safeCount > 0) {
    const parsedSum = typeof totalSum === 'number' ? totalSum : typeof totalSum === 'string' ? Number(totalSum) : 0;

    const safeSum = Number.isFinite(parsedSum) ? parsedSum : 0;
    const average = Number((safeSum / safeCount).toFixed(1));

    return {rating: average, reviews: safeCount};
  }

  const parsedReviews = typeof reviews === 'number' ? reviews : typeof reviews === 'string' ? Number(reviews) : 0;

  const safeReviews = Number.isFinite(parsedReviews) && parsedReviews > 0 ? Math.floor(parsedReviews) : 0;

  if (safeReviews === 0) {
    return {rating: 0, reviews: 0};
  }

  const parsedRating = typeof rating === 'number' ? rating : typeof rating === 'string' ? Number(rating) : 0;

  const safeRating = Number.isFinite(parsedRating) ? Number(parsedRating.toFixed(1)) : 0;
  return {rating: safeRating, reviews: safeReviews};
}

function normalizeStringArray(input: unknown): string[] {
  if (isStringArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRecommendStatus(value: unknown): RecommendStatus {
  if (isValidRecommendStatus(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 'neutral';
  }

  const normalized = value.trim().toLowerCase();

  if (['recommend', 'strong', 'good', '强推', '推荐'].includes(normalized)) {
    return 'recommend';
  }

  if (['avoid', 'bad', '避雷', '不推荐'].includes(normalized)) {
    return 'avoid';
  }

  return 'neutral';
}

function normalizeShopStatus(value: unknown): ShopStatus {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.trim().toLowerCase();

  if (VALID_SHOP_STATUS.includes(normalized as ShopStatus)) {
    return normalized as ShopStatus;
  }

  if (normalized === 'approved') {
    return 'verified';
  }

  return 'pending';
}

/**
 * Loose validation strategy:
 * keep any object row and let mapper apply defaults/fallbacks.
 */
export function isValidShop(data: unknown): data is Record<string, unknown> {
  return pickFirstRecord(data) !== null;
}

/**
 * Robust single-row mapper with alias support + loose defaults.
 */
export function mapSingleShop(row: Record<string, unknown>): Shop {
  const rawId = row?.id ?? row?.shop_id;
  const rawName = pickRawName(row);
  const rawAddress = pickRawAddress(row);
  const rawImageUrls = pickRawImageUrls(row);

  const rawType = row?.type ?? row?.category ?? row?.shop_type;
  const lngCandidate = row?.longitude ?? row?.lng ?? row?.lon;
  const latCandidate = row?.latitude ?? row?.lat;

  const explicitCoordinates = tryParseCoordinates([lngCandidate, latCandidate]);
  const fallbackCoordinatePayload = row?.coordinates ?? row?.location ?? row?.coord ?? row?.latlng;
  const fallbackCoordinates = tryParseCoordinates(fallbackCoordinatePayload);
  const normalizedCoordinates = explicitCoordinates ?? fallbackCoordinates;
  const hasCoordinates = normalizedCoordinates !== null;
  const rawTags = row?.tags;
  const rawMainCategory = row?.main_category;
  const rawSubTags = row?.sub_tags;
  const rawFeatures = row?.features;
  const rawShopType = row?.shop_type;
  const rawDiscount = row?.student_discount ?? null;
  const rawStatus = row?.recommend_status;
  const rawRating = row?.rating;
  const rawReviews = row?.reviews;
  const rawReviewCount = row?.review_count;
  const rawTotalSum = row?.total_sum;
  const rawRatingCount = row?.rating_count;
  const rawReviewText = row?.review_text;
  const rawShopStatus = row?.status;
  const rawCategory = row?.category;
  
  const rawPricePerPerson = row?.price_per_person;
  const rawRegion = row?.region;
  const rawSignatureDish = row?.signature_dish;
  const rawSharpReview = row?.sharp_review;

  const reviewMetrics = normalizeReviewMetrics(rawRating, rawReviews, rawReviewCount, rawTotalSum, rawRatingCount);
  const normalizedReviewText =
    typeof rawReviewText === 'string' && rawReviewText.trim().length > 0 ? rawReviewText.trim() : null;

  const normalizedMainCategory =
    typeof rawMainCategory === 'string' && rawMainCategory.trim().length > 0 ? rawMainCategory.trim() : null;
  const normalizedSubTags = normalizeStringArray(rawSubTags);
  const legacyTags = normalizeStringArray(rawTags);
  const mergedTags = Array.from(
    new Set([...(normalizedMainCategory ? [normalizedMainCategory] : []), ...normalizedSubTags, ...legacyTags])
  );

  const normalizedCategory = normalizeCategoryKey(rawCategory);

  const shop: Shop = {
    id: String(rawId ?? rawName),
    name: rawName,
    address: rawAddress,
    imageUrls: rawImageUrls,
    type: mapCategoryToShopType(rawType),
    category: normalizedCategory,
    coordinates: normalizedCoordinates ?? MACAU_CENTER,
    hasCoordinates,
    studentDiscount: typeof rawDiscount === 'string' ? rawDiscount : null,
    tags: mergedTags,
    features: normalizeFeatures(rawFeatures),
    shopType: normalizeShopDrawerType(rawShopType, mergedTags, normalizedSubTags),
    ratingLabel: normalizeRatingLabel(row?.rating_label, reviewMetrics.rating),
    mainCategory: normalizedMainCategory,
    subTags: normalizedSubTags,
    rating: reviewMetrics.rating,
    reviews: reviewMetrics.reviews,
    recommendStatus: normalizeRecommendStatus(rawStatus),
    reviewText: normalizedReviewText,
    status: normalizeShopStatus(rawShopStatus),
    pricePerPerson: parseMaybeNumber(rawPricePerPerson),
    region: typeof rawRegion === 'string' && rawRegion.trim().length > 0 ? (rawRegion.trim() as Shop['region']) : null,
    signatureDish: typeof rawSignatureDish === 'string' && rawSignatureDish.trim().length > 0 ? rawSignatureDish.trim() : null,
    sharpReview: typeof rawSharpReview === 'string' && rawSharpReview.trim().length > 0 ? rawSharpReview.trim() : null
  };

  return shop;
}

export function mapShopList(rows: unknown[]): Shop[] {
  return rows
    .filter((item) => {
      if (!isValidShop(item)) {
        console.warn('Item failed loose validation (non-object):', item);
        return false;
      }

      return true;
    })
    .map((item) => mapSingleShop(item as Record<string, unknown>));
}
