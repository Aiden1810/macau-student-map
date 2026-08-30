import {deriveTrustLabel} from '../ranking/confidence';
import type {Shop, ShopFeature, ShopRegion} from '../../types/shop';

const REGION_LABELS: Record<string, ShopRegion> = {
  'macau-peninsula': '澳门半岛',
  taipa: '氹仔岛',
  coloane: '路环岛',
  hengqin: '横琴区',
  zhuhai: '香洲区',
  other: '其它'
};

const FEATURE_BY_TAG: Record<string, ShopFeature> = {
  'student-discount': '学生价',
  'late-night': '深夜营业',
  'photo-friendly': '适合拍照',
  delivery: '外卖可达'
};

type CanonicalPlaceRow = {
  id: string;
  name: string;
  address: string | null;
  category_slug: 'food' | 'shopping' | 'entertainment' | 'service';
  region: string | null;
  longitude: number | null;
  latitude: number | null;
  price_per_person: number | string | null;
  rating_average: number | string | null;
  review_count: number | null;
  status: string;
  legacy_image_urls: string[] | null;
  place_tags?: Array<{tags: {id: string; slug: string; label_zh_mo: string} | null}>;
  place_media?: Array<{public_url?: string | null; sort_order?: number | null}>;
};

function finiteNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function mapCanonicalPlaceToShop(row: CanonicalPlaceRow): Shop {
  const tagRows = (row.place_tags ?? [])
    .map((relation) => relation.tags)
    .filter((tag): tag is NonNullable<typeof tag> => tag !== null);
  const tags = tagRows.map((tag) => tag.label_zh_mo);
  const features = tagRows
    .map((tag) => FEATURE_BY_TAG[tag.slug])
    .filter((feature): feature is ShopFeature => Boolean(feature));
  const rating = finiteNumber(row.rating_average) ?? 0;
  const reviews = Math.max(0, row.review_count ?? 0);
  const trust = deriveTrustLabel(row.rating_average === null ? null : rating, reviews);
  const mediaUrls = (row.place_media ?? [])
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    .map((media) => media.public_url?.trim() ?? '')
    .filter(Boolean);
  const longitude = finiteNumber(row.longitude);
  const latitude = finiteNumber(row.latitude);

  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    imageUrls: mediaUrls.length > 0 ? mediaUrls : row.legacy_image_urls ?? [],
    type: row.category_slug === 'food' ? '餐饮' : '服务',
    category: row.category_slug,
    coordinates: longitude !== null && latitude !== null ? [longitude, latitude] : [113.5439, 22.1987],
    hasCoordinates: longitude !== null && latitude !== null,
    studentDiscount: tagRows.some((tag) => tag.slug === 'student-discount') ? '有学生优惠' : null,
    tags,
    features,
    shopType: row.category_slug === 'service' ? '服务' : '全部',
    ratingLabel:
      trust === 'excellent'
        ? '封神之作'
        : trust === 'recommended'
          ? '强烈推荐'
          : trust === 'unrated'
            ? '暂无评分'
            : '还行吧',
    mainCategory: tags[0] ?? null,
    subTags: tags.slice(1),
    rating,
    reviews,
    recommendStatus: trust === 'excellent' || trust === 'recommended' ? 'recommend' : 'neutral',
    reviewText: null,
    status: row.status === 'published' ? 'verified' : 'pending',
    pricePerPerson: finiteNumber(row.price_per_person),
    region: row.region ? REGION_LABELS[row.region] ?? (row.region as ShopRegion) : null,
    signatureDish: null,
    sharpReview: null,
    phone: null
  };
}
