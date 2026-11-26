import {afterEach, describe, expect, it, vi} from 'vitest';
import {searchAmapDiscoveryPlaces} from '@/lib/amap/place-search';

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
});
