
import type {Shop} from '@/types/shop';
import type {PoiMetadata} from './business';
import {PAGE_SIZE, coordinatesSchema, inDiscoveryScope, poiAsShop, type Bounds, type Poi, type SearchScope} from './search';

export type CatalogPlace = {
  id: string; name: string; address: string | null; longitude: number; latitude: number; recommended: boolean
};
export type DiscoveryEntry = {
  shop: Shop; poiId?: string; placeId?: string; category?: string
};

// The catalog RPC clamps its offset to 2,000. Never ask it to repeat that page.
export function hasMoreCatalogRows(received: number, nextOffset: number) {
  return received > PAGE_SIZE && nextOffset <= 2000;
}

export function catalogArgs(scope: SearchScope, offset: number) {
  let bounds: Bounds | null = null;
  let text: string | null = null;
  if (scope.kind === 'text') text = scope.keyword || null;
  else if (scope.kind === 'viewport') bounds = scope.bounds;
  else {
    const [x, y] = scope.center;
    const radiusLat = scope.radius / 110000;
    const radiusLng = radiusLat / Math.max(0.0001, Math.cos(Math.abs(y) * Math.PI / 180));
    bounds = [Math.max(-180, x - radiusLng), Math.max(-90, y - radiusLat),
      Math.min(180, x + radiusLng), Math.min(90, y + radiusLat)];
  }
  return {p_bounds: bounds, p_text: text, p_offset: offset, p_city: scope.kind === 'text' ? scope.city ?? null : null};
}

export function mergeDiscoveryEntries(
  pois: Poi[], catalog: CatalogPlace[], metadata: PoiMetadata[], scope: SearchScope | null, recommendedOnly: boolean
): DiscoveryEntry[] {
  const byPoi = new Map(metadata.map(value => [value.poi_id, value]));
  const entries = new Map<string, DiscoveryEntry>();
  for (const poi of pois) {
    const meta = byPoi.get(poi.id);
    if (meta && (!meta.available || meta.current_poi_id !== poi.id)) continue;
    if (scope && scope.kind !== 'text' && !inDiscoveryScope(poi.coordinates, scope)) continue;
    const id = meta?.place_id ?? 'amap:' + poi.id;
    entries.set(id, {
      shop: {...poiAsShop(poi), id, studentRecommended: meta?.recommended ?? false},
      poiId: poi.id, placeId: meta?.place_id ?? undefined, category: poi.category
    });
  }
  for (const place of catalog) {
    if (entries.has(place.id)) continue;
    const coordinates = coordinatesSchema.safeParse([place.longitude, place.latitude]);
    if (!coordinates.success || (scope && scope.kind !== 'text' && !inDiscoveryScope(coordinates.data, scope))) continue;
    entries.set(place.id, {
      shop: {...poiAsShop({id: place.id, name: place.name, address: place.address ?? '', category: '', coordinates: coordinates.data}),
        id: place.id, studentRecommended: place.recommended},
      placeId: place.id
    });
  }
  return [...entries.values()].filter(entry => !recommendedOnly || entry.shop.studentRecommended);
}
