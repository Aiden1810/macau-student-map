import type {PlaceSearchItem} from './place';
import {normalizeSearchText, type PlaceCategorySlug} from './taxonomy';

export type PlaceSearchSort = 'relevance' | 'rating' | 'distance' | 'newest';

export type SearchCenter = {
  longitude: number;
  latitude: number;
};

export type PlaceSearchRequest = {
  query: string;
  category: PlaceCategorySlug | null;
  tagIds: string[];
  region: string | null;
  priceMax: number | null;
  minRating: number | null;
  openNow: boolean;
  sort: PlaceSearchSort;
  center: SearchCenter | null;
  page: number;
  pageSize: number;
};

export type PlaceSearchResponse = {
  request: PlaceSearchRequest;
  items: PlaceSearchItem[];
  total: number;
  suggestions: Array<{
    type: 'place' | 'category' | 'tag';
    id: string;
    label: string;
  }>;
  fallbackUsed: false;
};

const CATEGORY_VALUES = new Set<PlaceCategorySlug>(['food', 'shopping', 'entertainment', 'service']);
const SORT_VALUES = new Set<PlaceSearchSort>(['relevance', 'rating', 'distance', 'newest']);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asFiniteNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function normalizeTagIds(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawValues
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function normalizeCenter(value: unknown): SearchCenter | null {
  const center = asRecord(value);
  const longitude = asFiniteNumber(center.longitude);
  const latitude = asFiniteNumber(center.latitude);

  if (
    longitude === null ||
    latitude === null ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return {longitude, latitude};
}

export function normalizePlaceSearchRequest(input: unknown): PlaceSearchRequest {
  const value = asRecord(input);
  const category = typeof value.category === 'string' && CATEGORY_VALUES.has(value.category as PlaceCategorySlug)
    ? (value.category as PlaceCategorySlug)
    : null;
  const sort = typeof value.sort === 'string' && SORT_VALUES.has(value.sort as PlaceSearchSort)
    ? (value.sort as PlaceSearchSort)
    : 'relevance';
  const priceMax = asFiniteNumber(value.priceMax);
  const minRating = asFiniteNumber(value.minRating);

  return {
    query: typeof value.query === 'string' ? normalizeSearchText(value.query) : '',
    category,
    tagIds: normalizeTagIds(value.tagIds),
    region: typeof value.region === 'string' && value.region.trim() ? value.region.trim() : null,
    priceMax: priceMax !== null && priceMax >= 0 && priceMax <= 100_000 ? priceMax : null,
    minRating: minRating !== null && minRating >= 0 && minRating <= 5 ? minRating : null,
    openNow: value.openNow === true || value.openNow === 'true' || value.openNow === '1',
    sort,
    center: normalizeCenter(value.center),
    page: asBoundedInteger(value.page, 1, 1, 10_000),
    pageSize: asBoundedInteger(value.pageSize, 20, 1, 50)
  };
}
