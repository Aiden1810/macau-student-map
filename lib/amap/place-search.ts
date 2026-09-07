export type AmapPoiOption = {
  placeId: string;
  name: string;
  fullAddress: string;
  coordinates: [number, number];
};

export type AmapPlaceSearchPoi = {
  id?: string;
  name?: string;
  address?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
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

export function mapAmapPois(
  pois: readonly AmapPlaceSearchPoi[],
  unnamedPlaceLabel: string
): AmapPoiOption[] {
  return pois
    .map((poi) => {
      const longitude = Number(poi.location?.lng);
      const latitude = Number(poi.location?.lat);
      if (!poi.id || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null;
      }

      const region = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(' ');
      const fullAddress = [region, poi.address].filter(Boolean).join(' ').trim();

      return {
        placeId: String(poi.id),
        name: String(poi.name || '').trim() || unnamedPlaceLabel,
        fullAddress,
        coordinates: [longitude, latitude] as [number, number]
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
        if (status !== 'complete' || !result?.poiList?.pois) {
          if (result?.info && result.info !== 'OK') {
            reject(new Error(result.info));
            return;
          }
          resolve([]);
          return;
        }
        resolve(mapAmapPois(result.poiList.pois, unnamedPlaceLabel));
      });
    });
  });
}

export async function searchAmapPoiOptions(
  key: string,
  keyword: string,
  unnamedPlaceLabel: string
): Promise<AmapPoiOption[]> {
  const amap = await loadAmapPlaceSdk(key);
  const [macauOptions, zhuhaiOptions] = await Promise.all([
    searchCity(amap, '澳门', keyword, unnamedPlaceLabel),
    searchCity(amap, '珠海', keyword, unnamedPlaceLabel)
  ]);
  const options = mergeUniqueAmapPoiOptions(macauOptions, zhuhaiOptions);
  if (options.length > 0) return options;

  const [macauFallback, zhuhaiFallback] = await Promise.all([
    searchCity(amap, '澳门', `澳门特别行政区 ${keyword}`, unnamedPlaceLabel),
    searchCity(amap, '珠海', `珠海市 ${keyword}`, unnamedPlaceLabel)
  ]);
  return mergeUniqueAmapPoiOptions(macauFallback, zhuhaiFallback);
}
