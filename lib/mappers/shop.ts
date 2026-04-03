import {RecommendStatus, Shop, ShopStatus, ShopType} from '@/types/shop';

const VALID_SHOP_TYPES: ShopType[] = ['餐饮', '服务'];
const VALID_RECOMMEND_STATUS: RecommendStatus[] = ['recommend', 'neutral', 'avoid'];
const VALID_SHOP_STATUS: ShopStatus[] = ['pending', 'verified', 'rejected'];
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

function warnInvalidCoordinates(rawValue: unknown): [number, number] {
  console.warn('Invalid coordinate payload from AMap or source data. Falling back to Macau center.', rawValue);
  return MACAU_CENTER;
}

function parseCoordinates(input: unknown): [number, number] {
  if (Array.isArray(input) && input.length >= 2) {
    const lng = parseMaybeNumber(input[0]);
    const lat = parseMaybeNumber(input[1]);

    if (lng !== null && lat !== null) {
      return [lng, lat];
    }

    return warnInvalidCoordinates(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (trimmed.includes(',')) {
      const [lngRaw, latRaw] = trimmed.split(',');
      const lng = parseMaybeNumber(lngRaw);
      const lat = parseMaybeNumber(latRaw);

      if (lng !== null && lat !== null) {
        return [lng, lat];
      }

      return warnInvalidCoordinates(input);
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseCoordinates(parsed);
    } catch {
      return warnInvalidCoordinates(input);
    }
  }

  if (isObject(input)) {
    const lng = parseMaybeNumber(input?.lng ?? input?.lon ?? input?.longitude);
    const lat = parseMaybeNumber(input?.lat ?? input?.latitude);

    if (lng !== null && lat !== null) {
      return [lng, lat];
    }

    return warnInvalidCoordinates(input);
  }

  return warnInvalidCoordinates(input);
}

function normalizeReviewMetrics(
  rating: unknown,
  reviews: unknown,
  totalSum: unknown,
  ratingCount: unknown
): Pick<Shop, 'rating' | 'reviews'> {
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

function normalizeTags(input: unknown): string[] {
  return normalizeStringArray(input);
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
  const rawCoordinates =
    row?.coordinates ??
    row?.location ??
    row?.coord ??
    row?.latlng ??
    (lngCandidate !== undefined && latCandidate !== undefined ? [lngCandidate, latCandidate] : undefined);
  const rawTags = row?.tags;
  const rawDiscount = row?.student_discount ?? null;
  const rawStatus = row?.recommend_status;
  const rawRating = row?.rating;
  const rawReviews = row?.reviews;
  const rawTotalSum = row?.total_sum;
  const rawRatingCount = row?.rating_count;
  const rawReviewText = row?.review_text;
  const rawShopStatus = row?.status;

  const reviewMetrics = normalizeReviewMetrics(rawRating, rawReviews, rawTotalSum, rawRatingCount);
  const normalizedReviewText =
    typeof rawReviewText === 'string' && rawReviewText.trim().length > 0 ? rawReviewText.trim() : null;

  const shop: Shop = {
    id: String(rawId ?? rawName),
    name: rawName,
    address: rawAddress,
    imageUrls: rawImageUrls,
    type: mapCategoryToShopType(rawType),
    coordinates: parseCoordinates(rawCoordinates),
    studentDiscount: typeof rawDiscount === 'string' ? rawDiscount : null,
    tags: normalizeTags(rawTags),
    rating: reviewMetrics.rating,
    reviews: reviewMetrics.reviews,
    recommendStatus: normalizeRecommendStatus(rawStatus),
    reviewText: normalizedReviewText,
    status: normalizeShopStatus(rawShopStatus)
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
