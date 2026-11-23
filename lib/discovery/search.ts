
import {z} from 'zod';
import type {Shop} from '@/types/shop';

export const poiIdSchema = z.string().regex(/^[A-Z0-9]{6,32}$/);
export const placeIdSchema = z.uuid();
const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);
export const coordinatesSchema = z.tuple([longitude, latitude]).refine(([x, y]) => x !== 0 || y !== 0);
export type Coordinates = z.infer<typeof coordinatesSchema>;
const boundsSchema = z.tuple([longitude, latitude, longitude, latitude]).refine(
  ([west, south, east, north]) => east > west && north > south && east - west <= 5 && north - south <= 5
);
export type Bounds = z.infer<typeof boundsSchema>;
const page = z.number().int().min(1).max(10).default(1);
const text = z.string().trim().min(1).max(80);
export const discoveryQuery = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('text'), city: text.optional(), keyword: text.optional(), page}).strict(),
  z.object({kind: z.literal('around'), center: coordinatesSchema, radius: z.union([z.literal(1000), z.literal(3000), z.literal(5000)]), page}).strict(),
  z.object({kind: z.literal('viewport'), bounds: boundsSchema, page}).strict(),
  z.object({kind: z.literal('area'), city: text, address: text}).strict(),
  z.object({kind: z.literal('detail'), id: poiIdSchema}).strict(),
  z.object({kind: z.literal('details'), ids: z.array(poiIdSchema).min(1).max(10)}).strict()
]).refine(query => query.kind !== 'text' || Boolean(query.city || query.keyword));

export type DiscoveryQuery = z.infer<typeof discoveryQuery>;
export type SearchScope = Extract<DiscoveryQuery, {page: number}>;
export type Poi = {id: string; name: string; address: string; category: string; coordinates: Coordinates};
export type DiscoveryResult = {items: Poi[]; hasMore: boolean; resolvedScope?: SearchScope};
export const PAGE_SIZE = 20;
export const MAX_PAGE = 10;

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const halfLat = radians(b[1] - a[1]) / 2;
  const halfLng = radians(b[0] - a[0]) / 2;
  const h = Math.sin(halfLat) ** 2
    + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(halfLng) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function inDiscoveryScope(coordinates: Coordinates, scope: SearchScope): boolean {
  if (scope.kind === 'around') return distanceMeters(coordinates, scope.center) <= scope.radius;
  if (scope.kind === 'viewport') {
    const [west, south, east, north] = scope.bounds;
    const [x, y] = coordinates;
    return x >= west && x <= east && y >= south && y <= north;
  }
  return false;
}

export function poiAsShop(poi: Poi): Shop {
  return {
    id: 'amap:' + poi.id, name: poi.name, address: poi.address, coordinates: poi.coordinates,
    hasCoordinates: true, type: '餐饮', category: 'food', imageUrls: [], studentDiscount: null,
    tags: [], features: [], shopType: '全部', ratingLabel: '暂无评分',
    rating: 0, reviews: 0, recommendStatus: 'neutral', status: 'verified'
  };
}
