export type ShopType = '餐饮' | '服务';

export type RecommendStatus = 'recommend' | 'neutral' | 'avoid';

export type FilterOption = '全部' | '餐饮' | '服务' | '有折扣' | '强推';

export type ViewMode = 'list' | 'map';

export type ShopStatus = 'pending' | 'verified' | 'rejected';

export type ShopCategoryKey = 'all' | 'food' | 'drink' | 'vibe' | 'deal' | 'review';

export type ShopRatingLabel = '封神之作' | '强烈推荐' | '还行吧' | '建议避雷' | '暂无评分';

export const SHOP_DRAWER_TYPES = ['全部', '正餐', '快餐小吃', '饮品甜点', '服务'] as const;
export type ShopDrawerType = (typeof SHOP_DRAWER_TYPES)[number];

export const SHOP_FEATURE_OPTIONS = ['有折扣', '学生价', '深夜营业', '适合拍照', '外卖可达'] as const;
export type ShopFeature = (typeof SHOP_FEATURE_OPTIONS)[number];

export const FILTERABLE_RATING_LABELS = ['封神之作', '强烈推荐', '还行吧', '建议避雷'] as const;

export interface DrawerFiltersState {
  shopType: ShopDrawerType;
  ratingLabel: (typeof FILTERABLE_RATING_LABELS)[number] | null;
  features: ShopFeature[];
}

export type ShopRegion = '澳门半岛' | '氹仔岛' | '路环岛' | '香洲区' | '横琴区' | '其它';

export interface Shop {
  id: string;
  name: string;
  address: string;
  imageUrls: string[];
  type: ShopType;
  category: Exclude<ShopCategoryKey, 'all' | 'review'>;
  coordinates: [number, number];
  hasCoordinates: boolean;
  studentDiscount: string | null;
  tags: string[];
  features: ShopFeature[];
  shopType: ShopDrawerType;
  ratingLabel: ShopRatingLabel;
  mainCategory?: string | null;
  subTags?: string[];
  rating: number;
  reviews: number;
  recommendStatus: RecommendStatus;
  reviewText?: string | null;
  status: ShopStatus;
  pricePerPerson?: number | null;
  region?: ShopRegion | null;
  signatureDish?: string | null;
  sharpReview?: string | null;
}

export interface Comment {
  id: string;
  shopId: string;
  content: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface CommentImage {
  id: string;
  commentId: string;
  imageUrl: string;
  createdAt: string;
}

export type ShopId = Shop['id'];
