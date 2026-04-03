export type ShopType = '餐饮' | '服务';

export type RecommendStatus = 'recommend' | 'neutral' | 'avoid';

export type FilterOption = '全部' | '餐饮' | '服务' | '有折扣' | '强推';

export type ViewMode = 'list' | 'map';

export type ShopStatus = 'pending' | 'verified' | 'rejected';

export interface Shop {
  id: string;
  name: string;
  address: string;
  imageUrls: string[];
  type: ShopType;
  coordinates: [number, number];
  studentDiscount: string | null;
  tags: string[];
  rating: number;
  reviews: number;
  recommendStatus: RecommendStatus;
  reviewText?: string | null;
  status: ShopStatus;
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
