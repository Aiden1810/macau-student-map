export type AmapPoiCity = 'macau' | 'zhuhai' | 'unknown';
export type AmapPoiDistanceSource = 'user' | 'map';

export type AmapPoiSearchOrigin = {
  coordinates: [number, number];
  source: AmapPoiDistanceSource;
};

export type AmapPoiOption = {
  placeId: string;
  name: string;
  fullAddress: string;
  coordinates: [number, number];
  city: AmapPoiCity;
  rating?: number;
  distanceMeters?: number;
  distanceSource?: AmapPoiDistanceSource;
};

export type AmapSearchScope = 'all' | 'macau' | 'zhuhai';

const discoveryCategories = {food: '餐饮服务', service: '生活服务', shopping: '购物服务'} as const;
const discoveryRadiusMeters = 2000;
export type AmapDiscoveryCity = Exclude<AmapSearchScope, 'all'>;
export type AmapDiscoveryCategory = keyof typeof discoveryCategories;

// Use equivalent AMap POI categories only. Chengmi-specific facets stay in the site directory.
const nearbyDiningTypes = new Map([
  ['chinese-cuisine', '050100'],
  ['portuguese-cuisine', '050213'],
  ['japanese-cuisine', '050202'],
  ['korean-cuisine', '050203'],
  ['indian-cuisine', '050209'],
  ['hot-pot', '050117'],
  ['cha-chaan-teng', '050305'],
  ['fast-food', '050300'],
  ['coffee', '050500']
]);

export function amapDiningTypeForFilters(filters: readonly string[]): string | null {
  if (filters.length === 0) return '050000';
  const types = filters.map(filter => nearbyDiningTypes.get(filter));
  return types.includes(undefined) ? null : Array.from(new Set(types)).join('|');
}

export type AmapPlaceSearchPoi = {
  id?: string;
  name?: string;
  address?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  adcode?: string;
  rating?: unknown;
  biz_ext?: {rating?: unknown};
  bizExt?: {rating?: unknown};
  location?: {
    lng?: number;
    lat?: number;
  };
};

type AmapPlaceSearchResult = {
  info?: string;
  poiList?: {
    pois?: AmapPlaceSearchPoi[];
  };
};

type AmapPlaceSearchInstance = {
  search: (
    keyword: string,
    callback: (status: string, result: AmapPlaceSearchResult) => void
  ) => void;
  searchNearBy: (
    keyword: string,
    center: [number, number],
    radius: number,
    callback: (status: string, result: AmapPlaceSearchResult) => void
  ) => void;
};

type AmapNamespace = {
  plugin: (name: string, callback: () => void) => void;
  PlaceSearch: new (options: {
    city: string;
    citylimit: boolean;
    pageSize: number;
    pageIndex: number;
    extensions: 'base' | 'all';
    type?: string;
  }) => AmapPlaceSearchInstance;
};

type AmapWindow = Window & {
  AMap?: AmapNamespace;
  __amapPlaceLoadingPromise?: Promise<AmapNamespace>;
  _AMapSecurityConfig?: {serviceHost: string};
};

function inferAmapPoiCity(poi: AmapPlaceSearchPoi, fallbackCity?: string): AmapPoiCity {
  const adcode = String(poi.adcode ?? '');
  const administrativeText = [poi.pname, poi.cityname, poi.adname]
    .filter(Boolean)
    .join(' ');

  if (adcode.startsWith('82')) return 'macau';
  if (adcode.startsWith('4404')) return 'zhuhai';
  if (administrativeText.includes('澳门')) return 'macau';
  if (
    ['珠海', '香洲', '斗门', '金湾', '横琴'].some(name => administrativeText.includes(name))
  ) return 'zhuhai';
  if (!adcode && !administrativeText) {
    if (fallbackCity === '澳门') return 'macau';
    if (fallbackCity === '珠海') return 'zhuhai';
  }
  return 'unknown';
}

export function distanceMeters(from: [number, number], to: [number, number]): number {
  const earthRadius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to[1] - from[1]);
  const longitudeDelta = radians(to[0] - from[0]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function rankAmapPoiOptions(
  options: readonly AmapPoiOption[],
  origin: AmapPoiSearchOrigin | null
): AmapPoiOption[] {
  if (!origin) return [...options];

  return options
    .map((option, originalIndex) => ({
      option: {
        ...option,
        distanceMeters: distanceMeters(origin.coordinates, option.coordinates),
        distanceSource: origin.source
      },
      originalIndex
    }))
    .sort((left, right) =>
      left.option.distanceMeters - right.option.distanceMeters ||
      left.originalIndex - right.originalIndex
    )
    .map(({option}) => option);
}

export function mapAmapPois(
  pois: readonly AmapPlaceSearchPoi[],
  unnamedPlaceLabel: string,
  fallbackCity?: string
): AmapPoiOption[] {
  return pois
    .map((poi) => {
      const longitude = Number(poi.location?.lng);
      const latitude = Number(poi.location?.lat);
      if (!poi.id || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null;
      }

      const region = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(' ') || fallbackCity;
      const fullAddress = [region, poi.address].filter(Boolean).join(' ').trim();
      const rating = [poi.rating, poi.biz_ext?.rating, poi.bizExt?.rating]
        .map(value => typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN)
        .find(value => Number.isFinite(value) && value > 0 && value <= 5);

      return {
        placeId: String(poi.id),
        name: String(poi.name || '').trim() || unnamedPlaceLabel,
        fullAddress,
        coordinates: [longitude, latitude] as [number, number],
        city: inferAmapPoiCity(poi, fallbackCity),
        ...(rating !== undefined && {rating})
      };
    })
    .filter((option): option is AmapPoiOption => option !== null);
}

export function rankNearbyDining(options: readonly AmapPoiOption[], origin: AmapPoiSearchOrigin) {
  return rankAmapPoiOptions(options, origin).sort((left, right) =>
    Math.floor(left.distanceMeters! / 200) - Math.floor(right.distanceMeters! / 200)
    || (right.rating ?? -1) - (left.rating ?? -1)
    || left.distanceMeters! - right.distanceMeters!
  );
}

export function mergeUniqueAmapPoiOptions(
  ...groups: ReadonlyArray<readonly AmapPoiOption[]>
): AmapPoiOption[] {
  const seen = new Set<string>();
  return groups.flatMap((group) => group).filter((option) => {
    if (seen.has(option.placeId)) return false;
    seen.add(option.placeId);
    return true;
  });
}

export function toLegacyShopPoiFields<Region extends string>(
  option: AmapPoiOption,
  region: Region | null
) {
  return {
    name: option.name,
    address: option.fullAddress,
    amap_poi_id: option.placeId,
    longitude: String(option.coordinates[0]),
    latitude: String(option.coordinates[1]),
    region: (region ?? '') as Region | ''
  };
}

export function loadAmapPlaceSdk(key: string): Promise<AmapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap only works in browser'));
  }

  const amapWindow = window as AmapWindow;
  amapWindow._AMapSecurityConfig = {serviceHost: window.location.origin + '/_AMapService'};
  if (amapWindow.AMap) return Promise.resolve(amapWindow.AMap);
  if (amapWindow.__amapPlaceLoadingPromise) return amapWindow.__amapPlaceLoadingPromise;

  amapWindow.__amapPlaceLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-amap="true"]');
    const script = existingScript ?? document.createElement('script');
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (error) {
        script.remove();
        delete amapWindow.__amapPlaceLoadingPromise;
        reject(error);
      } else {
        resolve(amapWindow.AMap!);
      }
    };
    const onLoad = () => finish(amapWindow.AMap ? undefined : new Error('AMap script loaded but AMap is unavailable'));
    const onError = () => finish(new Error('Failed to load AMap script'));
    const timer = setTimeout(() => finish(new Error('AMap script load timed out')), 12000);
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existingScript) {
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.PlaceSearch`;
      script.async = true;
      script.defer = true;
      script.dataset.amap = 'true';
      document.head.appendChild(script);
    }
  });

  return amapWindow.__amapPlaceLoadingPromise;
}

async function searchCity(
  amap: AmapNamespace,
  city: string,
  keyword: string,
  unnamedPlaceLabel: string,
  discovery?: {category: AmapDiscoveryCategory | 'businesses'; origin?: AmapPoiSearchOrigin; page?: number; diningType?: string; citylimit?: boolean}
): Promise<AmapPoiOption[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (options: AmapPoiOption[], error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(options);
    };
    const timer = setTimeout(() => finish([], new Error('AMap search timed out')), 12000);
    amap.plugin('AMap.PlaceSearch', () => {
      if (settled) return;
      try {
        const placeSearch = new amap.PlaceSearch({
          city,
          citylimit: discovery?.citylimit ?? true,
          pageSize: discovery?.category === 'businesses' ? 25 : 8,
          pageIndex: discovery?.page ?? 1,
          extensions: discovery?.category === 'businesses' ? 'all' : 'base',
          ...(discovery && {type: discovery.category === 'businesses'
            ? discovery.diningType ?? '050000' : discoveryCategories[discovery.category]})
        });

        const onResult = (status: string, result: AmapPlaceSearchResult) => {
          if (settled) return;
          if (status === 'no_data' || result?.info === 'NO_DATA') {
            finish([]);
            return;
          }
          if (status !== 'complete' || !result?.poiList?.pois) {
            const error = result?.info && result.info !== 'OK' ? new Error(result.info) : undefined;
            finish([], error ?? new Error('AMap place search failed'));
            return;
          }
          finish(mapAmapPois(result.poiList.pois, unnamedPlaceLabel, city === '全国' ? undefined : city));
        };
        if (discovery?.origin) {
          placeSearch.searchNearBy(keyword, discovery.origin.coordinates, discoveryRadiusMeters, onResult);
        } else {
          placeSearch.search(keyword, onResult);
        }
      } catch (error) {
        finish([], error);
      }
    });
  });
}

export async function searchAmapDiscoveryPlaces(
  key: string,
  {city, category, keyword, origin}: {
    city: AmapDiscoveryCity;
    category: AmapDiscoveryCategory;
    keyword: string;
    origin?: AmapPoiSearchOrigin;
  },
  unnamedPlaceLabel: string
): Promise<AmapPoiOption[]> {
  const amap = await loadAmapPlaceSdk(key);
  const options = await searchCity(amap, city === 'macau' ? '澳门' : '珠海', keyword.trim(), unnamedPlaceLabel, {
    category,
    origin
  });
  const localOptions = options.filter(({city: resultCity, coordinates: [longitude, latitude]}) =>
    resultCity === city && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90 &&
    (longitude !== 0 || latitude !== 0)
  );
  const ranked = rankAmapPoiOptions(mergeUniqueAmapPoiOptions(localOptions), origin ?? null);
  return ranked.filter(({distanceMeters}) => distanceMeters === undefined || distanceMeters <= discoveryRadiusMeters);
}

export async function searchNearbyBusinesses(
  key: string, city: AmapSearchScope, coordinates: [number, number], unnamed: string, signal?: AbortSignal, keyword = '', diningType = '050000'
) {
  const amap = await loadAmapPlaceSdk(key);
  const origin = {coordinates, source: 'map'} as const;
  const searchCityName = city === 'macau' ? '澳门' : city === 'zhuhai' ? '珠海' : '全国';
  const restrictCity = city !== 'all';
  let items: AmapPoiOption[] = [];
  let partial = false;
  for (let page = 1; page <= 4; page++) {
    signal?.throwIfAborted();
    try {
      const batch = await searchCity(amap, searchCityName, keyword.trim(), unnamed, {
        category: 'businesses', origin, page, diningType, citylimit: restrictCity
      });
      const previousCount = items.length;
      items = mergeUniqueAmapPoiOptions(items, batch);
      if (batch.length < 25) break;
      if (page === 4 || items.length === previousCount) {
        partial = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    } catch (error) {
      if (!items.length) throw error;
      partial = true;
      break;
    }
  }
  signal?.throwIfAborted();
  const scoped = restrictCity ? items.filter(item => item.city === city) : items;
  const local = rankAmapPoiOptions(scoped, origin);
  return {items: local.filter(item => item.distanceMeters !== undefined && item.distanceMeters <= discoveryRadiusMeters), partial};
}

export async function searchAmapPoiOptions(
  key: string,
  keyword: string,
  unnamedPlaceLabel: string,
  scope: AmapSearchScope = 'all',
  origin: AmapPoiSearchOrigin | null = null
): Promise<AmapPoiOption[]> {
  const amap = await loadAmapPlaceSdk(key);
  const cities = scope === 'macau' ? ['澳门'] : scope === 'zhuhai' ? ['珠海'] : ['澳门', '珠海'];
  const groups = await Promise.all(cities.map(async city => {
    const options = await searchCity(amap, city, keyword, unnamedPlaceLabel);
    if (options.length > 0) return options;
    const prefix = city === '澳门' ? '澳门特别行政区' : '珠海市';
    return searchCity(amap, city, `${prefix} ${keyword}`, unnamedPlaceLabel);
  }));
  // Keep both cities visible without making the user scroll past all Macau hits.
  const interleaved: AmapPoiOption[] = [];
  for (let index = 0; index < Math.max(...groups.map(group => group.length)); index++) {
    for (const group of groups) {
      if (group[index]) interleaved.push(group[index]);
    }
  }
  return rankAmapPoiOptions(mergeUniqueAmapPoiOptions(interleaved), origin);
}
