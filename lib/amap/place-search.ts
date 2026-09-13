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
  distanceMeters?: number;
  distanceSource?: AmapPoiDistanceSource;
};

export type AmapSearchScope = 'all' | 'macau' | 'zhuhai';

export type AmapPlaceSearchPoi = {
  id?: string;
  name?: string;
  address?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  adcode?: string;
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
};

type AmapNamespace = {
  plugin: (name: string, callback: () => void) => void;
  PlaceSearch: new (options: {
    city: string;
    citylimit: boolean;
    pageSize: number;
    pageIndex: number;
    extensions: 'base' | 'all';
  }) => AmapPlaceSearchInstance;
};

type AmapWindow = Window & {
  AMap?: AmapNamespace;
  __amapPlaceLoadingPromise?: Promise<AmapNamespace>;
  _AMapSecurityConfig?: {securityJsCode?: string};
};

function inferAmapPoiCity(poi: AmapPlaceSearchPoi, fallbackCity?: string): AmapPoiCity {
  const adcode = String(poi.adcode ?? '');
  const administrativeText = [poi.pname, poi.cityname, poi.adname, fallbackCity]
    .filter(Boolean)
    .join(' ');

  if (adcode.startsWith('82') || administrativeText.includes('澳门')) return 'macau';
  if (
    adcode.startsWith('4404') ||
    ['珠海', '香洲', '斗门', '金湾', '横琴'].some(name => administrativeText.includes(name))
  ) return 'zhuhai';
  return 'unknown';
}

function distanceMeters(from: [number, number], to: [number, number]): number {
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

      return {
        placeId: String(poi.id),
        name: String(poi.name || '').trim() || unnamedPlaceLabel,
        fullAddress,
        coordinates: [longitude, latitude] as [number, number],
        city: inferAmapPoiCity(poi, fallbackCity)
      };
    })
    .filter((option): option is AmapPoiOption => option !== null);
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

function loadAmapPlaceSdk(key: string): Promise<AmapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap only works in browser'));
  }

  const amapWindow = window as AmapWindow;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  if (securityCode && !amapWindow._AMapSecurityConfig) {
    amapWindow._AMapSecurityConfig = {securityJsCode: securityCode};
  }
  if (amapWindow.AMap) return Promise.resolve(amapWindow.AMap);
  if (amapWindow.__amapPlaceLoadingPromise) return amapWindow.__amapPlaceLoadingPromise;

  amapWindow.__amapPlaceLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-amap="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (amapWindow.AMap) resolve(amapWindow.AMap);
      });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load AMap script')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.PlaceSearch`;
    script.async = true;
    script.defer = true;
    script.dataset.amap = 'true';
    script.onload = () => {
      if (amapWindow.AMap) {
        resolve(amapWindow.AMap);
      } else {
        reject(new Error('AMap script loaded but AMap is unavailable'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load AMap script'));
    document.head.appendChild(script);
  });

  return amapWindow.__amapPlaceLoadingPromise;
}

async function searchCity(
  amap: AmapNamespace,
  city: string,
  keyword: string,
  unnamedPlaceLabel: string
): Promise<AmapPoiOption[]> {
  return new Promise((resolve, reject) => {
    amap.plugin('AMap.PlaceSearch', () => {
      const placeSearch = new amap.PlaceSearch({
        city,
        citylimit: true,
        pageSize: 8,
        pageIndex: 1,
        extensions: 'base'
      });

      placeSearch.search(keyword, (status, result) => {
        if (status === 'no_data' || result?.info === 'NO_DATA') {
          resolve([]);
          return;
        }
        if (status !== 'complete' || !result?.poiList?.pois) {
          if (result?.info && result.info !== 'OK') {
            reject(new Error(result.info));
            return;
          }
          resolve([]);
          return;
        }
        resolve(mapAmapPois(result.poiList.pois, unnamedPlaceLabel, city));
      });
    });
  });
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
