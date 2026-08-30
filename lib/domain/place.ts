import type {PlaceCategorySlug, TagKind} from './taxonomy';

export type PlaceStatus = 'draft' | 'published' | 'archived';

export type PlaceRegion = 'macau-peninsula' | 'taipa' | 'coloane' | 'hengqin' | 'zhuhai' | 'other';

export type PlaceTag = {
  id: string;
  slug: string;
  kind: TagKind;
  label: string;
};
export type PlaceMedia = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
};

export type Place = {
  id: string;
  name: string;
  nameEn: string | null;
  address: string | null;
  category: PlaceCategorySlug;
  region: PlaceRegion | null;
  longitude: number | null;
  latitude: number | null;
  pricePerPerson: number | null;
  ratingAverage: number | null;
  reviewCount: number;
  confidenceScore: number | null;
  tags: PlaceTag[];
  media: PlaceMedia[];
  status: PlaceStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaceSearchMatch =
  | 'name_exact'
  | 'name_prefix'
  | 'name_contains'
  | 'tag'
  | 'tag_alias'
  | 'region'
  | 'full_text'
  | 'filter_only';

export type PlaceSearchItem = Place & {
  score: number;
  matchedBy: PlaceSearchMatch[];
  distanceMeters: number | null;
};
