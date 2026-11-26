import {afterEach, describe, expect, it, vi} from 'vitest';
import {amapDiningTypeForFilters, mapAmapPois, rankNearbyDining, searchAmapDiscoveryPlaces, searchNearbyBusinesses} from '@/lib/amap/place-search';

const origin = {source: 'map' as const, coordinates: [113.55, 22.16] as [number, number]};
const pois = [
  {id: 'far', name: 'Far', adcode: '820001', location: {lng: 113.56, lat: 22.16}},
  {id: 'near', name: 'Near', adcode: '820001', location: {lng: 113.551, lat: 22.16}},
  {id: 'near', name: 'Near', adcode: '820001', location: {lng: 113.551, lat: 22.16}},
  {id: 'outside', name: 'Outside', adcode: '440400', location: {lng: 113.55, lat: 22.16}},
  {id: 'outside-radius', name: 'Outside radius', adcode: '820001', location: {lng: 113.6, lat: 22.16}}
];

function installSdk(status = 'complete', result: unknown = {poiList: {pois}}) {
  const search = vi.fn((_, callback) => callback(status, result));
  const searchNearBy = vi.fn((_, _center, _radius, callback) => callback(status, result));
  const PlaceSearch = vi.fn(function () {return {search, searchNearBy};});
  vi.stubGlobal('window', {location: {origin: 'https://city.test'}, AMap: {
    plugin: (_name: string, ready: () => void) => ready(),
    PlaceSearch
  }});
  return {search, searchNearBy, PlaceSearch};
}

describe('homepage AMap discovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches once within 2 km, excludes other cities, deduplicates and ranks by distance', async () => {
    const sdk = installSdk();
    const results = await searchAmapDiscoveryPlaces('test-key', {
      city: 'macau', category: 'food', keyword: '', origin
    }, 'Unnamed');

    expect(sdk.PlaceSearch).toHaveBeenCalledWith(expect.objectContaining({city: '澳门', citylimit: true, type: '餐饮服务'}));
    expect(sdk.searchNearBy).toHaveBeenCalledExactlyOnceWith('', origin.coordinates, 2000, expect.any(Function));
    expect(sdk.search).not.toHaveBeenCalled();
    expect(results.map(result => result.placeId)).toEqual(['near', 'far']);
    expect(results[0]).toMatchObject({distanceSource: 'map', distanceMeters: expect.any(Number)});
  });

  it('uses manual area and category without requiring location permission', async () => {
    const sdk = installSdk('no_data', {info: 'NO_DATA'});
    await expect(searchAmapDiscoveryPlaces('test-key', {
      city: 'zhuhai', category: 'service', keyword: '横琴 打印'
    }, 'Unnamed')).resolves.toEqual([]);
    expect(sdk.PlaceSearch).toHaveBeenCalledWith(expect.objectContaining({city: '珠海', type: '生活服务'}));
    expect(sdk.search).toHaveBeenCalledExactlyOnceWith('横琴 打印', expect.any(Function));
    expect(sdk.searchNearBy).not.toHaveBeenCalled();
  });

  it('keeps provider failure distinct from an empty result', async () => {
    installSdk('error', {});
    await expect(searchAmapDiscoveryPlaces('test-key', {
      city: 'macau', category: 'food', keyword: ''
    }, 'Unnamed')).rejects.toThrow();
  });

  it('requests in-range restaurants with original score information and supports a keyword', async () => {
    const sdk = installSdk();
    const response = await searchNearbyBusinesses('test-key', 'macau', origin.coordinates, 'Unnamed', undefined, 'noodles');
    expect(sdk.PlaceSearch).toHaveBeenCalledWith(expect.objectContaining({
      pageSize: 25, pageIndex: 1, type: '050000', extensions: 'all'
    }));
    expect(response.items.map(item => item.placeId)).toEqual(['near', 'far']);
    expect(response.partial).toBe(false);
    expect(sdk.searchNearBy).toHaveBeenCalledWith('noodles', origin.coordinates, 2000, expect.any(Function));
  });

  it('keeps shared dining categories on AMap and delegates unsupported facets to the directory', () => {
    expect(amapDiningTypeForFilters([])).toBe('050000');
    expect(amapDiningTypeForFilters(['japanese-cuisine', 'hot-pot'])).toBe('050202|050117');
    expect(amapDiningTypeForFilters(['other-cuisine'])).toBeNull();
    expect(amapDiningTypeForFilters(['japanese-cuisine', 'food-siu-mei'])).toBeNull();
  });

  it('combines a cuisine type with an independent search keyword', async () => {
    const sdk = installSdk();
    await searchNearbyBusinesses('test-key', 'macau', origin.coordinates, 'Unnamed', undefined, '寿司', '050202');
    expect(sdk.PlaceSearch).toHaveBeenCalledWith(expect.objectContaining({type: '050202', extensions: 'all'}));
    expect(sdk.searchNearBy).toHaveBeenCalledWith('寿司', origin.coordinates, 2000, expect.any(Function));
  });

  it('uses AMap ratings inside distance bands while preserving unknown ratings', () => {
    const entries = mapAmapPois([
      {id:'unrated', name:'Unrated', location:{lng:113.5503,lat:22.16}, rating:'[]'},
      {id:'low', name:'Low', location:{lng:113.5504,lat:22.16}, rating:'3.8'},
      {id:'high', name:'High', location:{lng:113.5515,lat:22.16}, biz_ext:{rating:'4.7'}},
      {id:'far-high', name:'Far', location:{lng:113.556,lat:22.16}, rating:5}
    ], 'Unnamed', '澳门');
    const results = rankNearbyDining(entries, origin);
    expect(results.map(item=>item.placeId)).toEqual(['high','low','unrated','far-high']);
    expect(results.map(item=>item.rating)).toEqual([4.7,3.8,undefined,5]);
  });
});
