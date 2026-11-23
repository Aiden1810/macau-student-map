
import {z} from 'zod';
import {
  coordinatesSchema, MAX_PAGE, PAGE_SIZE, poiIdSchema, type Coordinates, type DiscoveryQuery,
  type DiscoveryResult, type Poi
} from '@/lib/discovery/search';

export class DiscoveryError extends Error {
  constructor(readonly code: string, readonly status: number) {super(code);}
}
type FetchUpstream = (url: URL, init: RequestInit) => Promise<Response>;
const quotaCodes = new Set(['10003', '10004', '10014', '10015', '10019', '10020', '10021', '10044', '10045', '40003']);
const coordinateText = ([x, y]: Coordinates) => x.toFixed(6) + ',' + y.toFixed(6);
const optionalText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const envelope = z.object({status: z.union([z.string(), z.number()]), infocode: z.coerce.string().optional()});
const poiValue = z.looseObject({id: z.unknown(), name: z.unknown(), location: z.unknown()});
const matches = z.object({count: z.coerce.number().int().nonnegative().optional(), pois: z.array(z.unknown())});

function readCoordinates(value: unknown) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = coordinatesSchema.safeParse(value.split(',').map(Number));
  return parsed.success ? parsed.data : null;
}

function readPoi(value: unknown): Poi | null {
  const parsed = poiValue.safeParse(value);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const coordinates = readCoordinates(raw.location);
  const id = poiIdSchema.safeParse(raw.id);
  const name = optionalText(raw.name);
  // Do not accept an unrelated place from the unfiltered ID lookup.
  const typecode = optionalText(raw.typecode);
  if (!coordinates || !id.success || !name || !/^05\d{4}$/.test(typecode)) return null;
  const category = optionalText(raw.type).split(';').filter(Boolean).at(-1) || '';
  const address = [...new Set([raw.cityname, raw.adname, raw.address].map(optionalText).filter(Boolean))].join(' ');
  return {id: id.data, name, address, category, coordinates};
}

export function createDiscoveryProvider(key: string | undefined, fetchUpstream: FetchUpstream = fetch, timeoutMs = 8000) {
  async function request(path: string, params: Record<string, string>, caller?: AbortSignal) {
    if (!key) throw new DiscoveryError('NOT_CONFIGURED', 503);
    const timeout = AbortSignal.timeout(timeoutMs);
    const url = new URL(path, 'https://restapi.amap.com');
    url.search = new URLSearchParams({...params, key}).toString();
    try {
      const response = await fetchUpstream(url, {
        cache: 'no-store', redirect: 'error',
        signal: caller ? AbortSignal.any([caller, timeout]) : timeout
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new DiscoveryError(response.status === 429 ? 'QUOTA' : 'PROVIDER_FAILED',
          response.status === 429 ? 429 : 502);
      }
      const body: unknown = await response.json();
      const parsed = envelope.safeParse(body);
      if (!parsed.success) throw new DiscoveryError('PROVIDER_FAILED', 502);
      if (String(parsed.data.status) !== '1') {
        if (quotaCodes.has(parsed.data.infocode ?? '')) throw new DiscoveryError('QUOTA', 429);
        throw new DiscoveryError('PROVIDER_FAILED', 502);
      }
      return body;
    } catch (error) {
      if (error instanceof DiscoveryError) throw error;
      throw new DiscoveryError(timeout.aborted ? 'TIMEOUT' : 'PROVIDER_FAILED', timeout.aborted ? 504 : 502);
    }
  }

  return async function search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryResult> {
    let resolvedScope: DiscoveryResult['resolvedScope'];
    if (query.kind === 'area') {
      const response = await request('/v3/geocode/geo', {address: query.address, city: query.city}, signal);
      const geocodes = z.object({geocodes: z.array(z.object({location: z.unknown()}))}).safeParse(response);
      if (!geocodes.success) throw new DiscoveryError('PROVIDER_FAILED', 502);
      const center = readCoordinates(geocodes.data.geocodes[0]?.location);
      if (geocodes.data.geocodes.length === 0) return {items: [], hasMore: false};
      if (!center) throw new DiscoveryError('PROVIDER_FAILED', 502);
      resolvedScope = {kind: 'around', center, radius: 3000, page: 1};
      query = resolvedScope;
    }
    const params: Record<string, string> = {};
    let path: string = query.kind;
    if (query.kind === 'detail' || query.kind === 'details') {
      path = 'detail';
      params.id = query.kind === 'detail' ? query.id : [...new Set(query.ids)].join('|');
    } else {
      params.types = '050000';
      params.page_num = String(query.page);
      params.page_size = String(PAGE_SIZE);
      if (query.kind === 'text') {
        if (query.keyword) params.keywords = query.keyword;
        if (query.city) {
          params.region = query.city;
          params.city_limit = 'true';
        }
      } else if (query.kind === 'around') {
        params.location = coordinateText(query.center);
        params.radius = String(query.radius);
        params.sortrule = 'distance';
      } else {
        const [west, south, east, north] = query.bounds;
        path = 'polygon';
        params.polygon = coordinateText([west, north]) + '|' + coordinateText([east, south]);
      }
    }
    const parsed = matches.safeParse(await request('/v5/place/' + path, params, signal));
    if (!parsed.success) throw new DiscoveryError('PROVIDER_FAILED', 502);
    const items = new Map<string, Poi>();
    for (const entry of parsed.data.pois) {
      const poi = readPoi(entry);
      if (poi && (query.kind !== 'detail' || query.id === poi.id)
        && (query.kind !== 'details' || query.ids.includes(poi.id))) items.set(poi.id, poi);
    }
    const isSearch = query.kind !== 'detail' && query.kind !== 'details';
    if (isSearch && parsed.data.pois.length > 0 && items.size === 0) throw new DiscoveryError('PROVIDER_FAILED', 502);
    const hasMore = 'page' in query && query.page < MAX_PAGE
      && parsed.data.pois.length === PAGE_SIZE;
    return {items: [...items.values()], hasMore, resolvedScope};
  };
}
