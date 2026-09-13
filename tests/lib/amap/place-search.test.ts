import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  mapAmapPois,
  mergeUniqueAmapPoiOptions,
  rankAmapPoiOptions,
  toLegacyShopPoiFields,
  searchAmapPoiOptions,
  type AmapPlaceSearchPoi
} from '../../../lib/amap/place-search';

describe('AMap POI normalization', () => {
  it('filters POIs without an id or finite coordinates', () => {
    const options = mapAmapPois(
      [
        {id: 'valid', name: '校园汉堡', address: '大学大马路', location: {lng: 113.55, lat: 22.16}},
        {name: '缺少 ID', location: {lng: 113.55, lat: 22.16}},
        {id: 'bad-coordinate', name: '错误坐标', location: {lng: Number.POSITIVE_INFINITY, lat: 22.16}}
      ],
      '未命名地点'
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({placeId: 'valid', coordinates: [113.55, 22.16]});
  });

  it('combines the administrative area and POI address', () => {
    const [option] = mapAmapPois(
      [
        {
          id: 'poi-1',
          name: '澳门茶餐厅',
          pname: '澳门特别行政区',
          cityname: '澳门特别行政区',
          adname: '花地玛堂区',
          address: '关闸广场 1 号',
          location: {lng: 113.55, lat: 22.21}
        }
      ],
      '未命名地点'
    );

    expect(option.fullAddress).toBe('澳门特别行政区 澳门特别行政区 花地玛堂区 关闸广场 1 号');
    expect(option.city).toBe('macau');
  });

  it('uses provider administrative data to identify Macau and Zhuhai', () => {
    const options = mapAmapPois(
      [
        {
          id: 'macau',
          name: '澳门分店',
          cityname: '澳门特别行政区',
          adname: '花地玛堂区',
          location: {lng: 113.55, lat: 22.21}
        },
        {
          id: 'zhuhai',
          name: '珠海分店',
          cityname: '珠海市',
          adname: '香洲区',
          location: {lng: 113.58, lat: 22.27}
        }
      ],
      '未命名地点'
    );

    expect(options.map(option => option.city)).toEqual(['macau', 'zhuhai']);
  });

  it('sorts POI candidates by the search origin and keeps equal distances stable', () => {
    const options = [
      {placeId: 'far', name: '远店', fullAddress: '珠海', coordinates: [113.58, 22.27] as [number, number], city: 'zhuhai' as const},
      {placeId: 'near', name: '近店', fullAddress: '澳门', coordinates: [113.545, 22.2] as [number, number], city: 'macau' as const},
      {placeId: 'tie', name: '同距离店', fullAddress: '澳门', coordinates: [113.545, 22.2] as [number, number], city: 'macau' as const}
    ];

    const ranked = rankAmapPoiOptions(options, {
      coordinates: [113.5439, 22.2],
      source: 'user'
    });

    expect(ranked.map(option => option.placeId)).toEqual(['near', 'tie', 'far']);
    expect(ranked[0].distanceSource).toBe('user');
    expect(ranked[0].distanceMeters).toBeGreaterThan(100);
    expect(ranked[0].distanceMeters).toBeLessThan(120);
  });

  it('keeps the first result when Macau and Zhuhai return the same provider id', () => {
    const macau = {placeId: 'same-id', name: '澳门结果', fullAddress: '澳门', coordinates: [113.55, 22.2] as [number, number], city: 'macau' as const};
    const zhuhai = {placeId: 'same-id', name: '珠海结果', fullAddress: '珠海', coordinates: [113.56, 22.21] as [number, number], city: 'zhuhai' as const};

    expect(mergeUniqueAmapPoiOptions([macau], [zhuhai])).toEqual([macau]);
  });

  it('maps a selected provider POI to editable legacy shop fields', () => {
    const fields = toLegacyShopPoiFields(
      {
        placeId: 'B0FFTEST',
        name: '校园汉堡',
        fullAddress: '澳门氹仔大学大马路',
        coordinates: [113.5567, 22.1634],
        city: 'macau'
      },
      '氹仔岛'
    );

    expect(fields).toEqual({
      name: '校园汉堡',
      address: '澳门氹仔大学大马路',
      amap_poi_id: 'B0FFTEST',
      longitude: '113.5567',
      latitude: '22.1634',
      region: '氹仔岛'
    });
    expect(fields).not.toHaveProperty('sourcePlaceId');
  });
});

describe('AMap cross-city search', () => {
  afterEach(() => vi.unstubAllGlobals());

  function installSdk(reply: (city: string, keyword: string) => {status: string; info: string; pois?: AmapPlaceSearchPoi[]}) {
    vi.stubGlobal('window', {AMap: {
      plugin: (_name: string, ready: () => void) => ready(),
      PlaceSearch: class {
        constructor(private options: {city: string}) {}
        search(keyword: string, callback: (status: string, result: unknown) => void) {
          const result = reply(this.options.city, keyword);
          callback(result.status, {info: result.info, poiList: result.pois ? {pois: result.pois} : undefined});
        }
      }
    }});
  }
  const poi = (id: string, coordinates: [number, number] = [113.55, 22.2]): AmapPlaceSearchPoi => ({
    id, name: id, address: '示例路1号', location: {lng: coordinates[0], lat: coordinates[1]}
  });

  it('shows both cities at the top instead of burying Zhuhai below every Macau result', async () => {
    installSdk(city => ({status: 'complete', info: 'OK', pois: [poi(city + '1'), poi(city + '2')]}));
    const results = await searchAmapPoiOptions('test-key', '理发', '未命名');
    expect(results.map(result => result.placeId)).toEqual(['澳门1', '珠海1', '澳门2', '珠海2']);
  });

  it('applies the captured map origin to the completed POI search', async () => {
    installSdk(city => ({
      status: 'complete',
      info: 'OK',
      pois: [city === '澳门' ? poi('澳门远店', [113.54, 22.19]) : poi('珠海近店', [113.58, 22.27])]
    }));

    const results = await searchAmapPoiOptions(
      'test-key',
      '麦当劳',
      '未命名',
      'all',
      {coordinates: [113.581, 22.271], source: 'map'}
    );

    expect(results.map(result => result.placeId)).toEqual(['珠海近店', '澳门远店']);
    expect(results.map(result => result.distanceSource)).toEqual(['map', 'map']);
  });

  it('searches only Zhuhai when the user selects Zhuhai', async () => {
    installSdk(city => ({status: 'complete', info: 'OK', pois: [poi(city)]}));
    const results = await searchAmapPoiOptions('test-key', '理发', '未命名', 'zhuhai');
    expect(results.map(result => result.placeId)).toEqual(['珠海']);
  });

  it('labels the city even when the SDK omits administrative fields', async () => {
    installSdk(city => ({status: 'complete', info: 'OK', pois: [poi(city)]}));
    const results = await searchAmapPoiOptions('test-key', '理发', '未命名');
    expect(results.map(result => result.fullAddress)).toEqual(['澳门 示例路1号', '珠海 示例路1号']);
  });

  it('tries the empty city fallback even when the other city has results', async () => {
    installSdk((city, keyword) => ({
      status: 'complete', info: 'OK',
      pois: city === '澳门' || keyword === '珠海市 理发' ? [poi(city)] : []
    }));
    const results = await searchAmapPoiOptions('test-key', '理发', '未命名');
    expect(results.map(result => result.placeId)).toEqual(['澳门', '珠海']);
  });

  it('treats NO_DATA as an empty city rather than failing the whole search', async () => {
    installSdk(city => city === '澳门'
      ? {status: 'no_data', info: 'NO_DATA'}
      : {status: 'complete', info: 'OK', pois: [poi('珠海')]});
    const results = await searchAmapPoiOptions('test-key', '理发', '未命名');
    expect(results.map(result => result.placeId)).toEqual(['珠海']);
  });

  it('still reports provider errors instead of disguising them as empty results', async () => {
    installSdk(() => ({status: 'error', info: 'INVALID_USER_KEY'}));
    await expect(searchAmapPoiOptions('test-key', '理发', '未命名')).rejects.toThrow('INVALID_USER_KEY');
  });
});
