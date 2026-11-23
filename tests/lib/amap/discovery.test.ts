
import {describe, expect, it, vi} from 'vitest';
import {createDiscoveryProvider, DiscoveryError} from '@/lib/amap/discovery-provider';
import {discoveryQuery, distanceMeters, inDiscoveryScope} from '@/lib/discovery/search';

const restaurant = {id: 'B000000001', name: 'Sample', location: '113.54,22.18', type: '餐饮服务;中餐厅', typecode: '050100'};
const reply = (body: object) => new Response(JSON.stringify(body));

describe('AMap discovery', () => {
  it('supports cities on both sides of the border and requests a single page', async () => {
    const upstream = vi.fn<(url: URL) => Promise<Response>>(async () => reply({status: '1', count: '30', pois: Array(20).fill(restaurant)}));
    const search = createDiscoveryProvider('server-key', upstream);
    for (const city of ['澳门', '广州市']) {
      const result = await search(discoveryQuery.parse({kind: 'text', city, page: 2}));
      expect(result.items).toHaveLength(1);
      const url = upstream.mock.calls.at(-1)![0];
      expect(url.pathname).toBe('/v5/place/text');
      expect(url.searchParams.get('region')).toBe(city);
      expect(url.searchParams.get('page_num')).toBe('2');
      expect(url.searchParams.get('city_limit')).toBe('true');
    }
  });

  it('passes GCJ-02 coordinates, radius and northwest/southeast corners', async () => {
    const upstream = vi.fn<(url: URL) => Promise<Response>>(async () => reply({status: '1', count: '0', pois: []}));
    const search = createDiscoveryProvider('key', upstream);
    for (const radius of [1000, 3000, 5000]) {
      await search(discoveryQuery.parse({kind: 'around', center: [113.54, 22.18], radius}));
      expect(upstream.mock.calls.at(-1)![0].searchParams.get('radius')).toBe(String(radius));
    }
    await search(discoveryQuery.parse({kind: 'viewport', bounds: [113, 22, 114, 23]}));
    expect(upstream.mock.calls.at(-1)![0].searchParams.get('polygon')).toBe('113.000000,23.000000|114.000000,22.000000');
    expect(distanceMeters([113.54, 22.18], [113.55, 22.18])).toBeCloseTo(1029.7, 0);
    expect(inDiscoveryScope([113.55, 22.18], {kind: 'around', page: 1, center: [113.54, 22.18], radius: 1000})).toBe(false);
  });

  it('keeps quota, malformed results and upstream failure distinct from zero matches', async () => {
    const query = discoveryQuery.parse({kind: 'text', keyword: 'food'});
    const upstream = vi.fn()
      .mockResolvedValueOnce(reply({status: '0', infocode: '10003'}))
      .mockResolvedValueOnce(reply({status: '1'}))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(reply({status: '1', count: '0', pois: []}));
    const search = createDiscoveryProvider('key', upstream);
    await expect(search(query)).rejects.toMatchObject({status: 429});
    await expect(search(query)).rejects.toBeInstanceOf(DiscoveryError);
    await expect(search(query)).rejects.toMatchObject({status: 502});
    await expect(search(query)).resolves.toMatchObject({items: [], hasMore: false});
  });

  it('resolves a street to an area and reuses its coordinates for later pages', async () => {
    const upstream = vi.fn<(url: URL) => Promise<Response>>()
      .mockResolvedValueOnce(reply({status: '1', geocodes: [{location: '113.54,22.18'}]}))
      .mockResolvedValueOnce(reply({status: '1', count: '1', pois: [restaurant]}));
    const search = createDiscoveryProvider('key', upstream);
    const result = await search({kind: 'area', city: '澳门', address: '新马路'});
    expect(result.resolvedScope).toEqual({kind: 'around', center: [113.54, 22.18], radius: 3000, page: 1});
    expect(upstream.mock.calls.map(([url]) => url.pathname)).toEqual(['/v3/geocode/geo', '/v5/place/around']);
  });

  it('returns an explicit timeout when the provider exceeds its deadline', async () => {
    const upstream = vi.fn<typeof fetch>().mockImplementation(async (...[, init]) => {
      if (!init?.signal) throw new Error('Expected signal');
      const signal = init.signal;
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      });
      throw new Error('Unexpected completion');
    });
    const search = createDiscoveryProvider('key', upstream, 5);
    await expect(search({kind: 'detail', id: 'B000000001'})).rejects.toMatchObject({code: 'TIMEOUT', status: 504});
  });

  it('preserves homonymous branches and rejects wrong detail IDs and coordinates', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(reply({status: '1', count: '3', pois: [
        restaurant, {...restaurant, id: 'B000000002'}, {...restaurant, id: 'B000000003', location: '0,0'}
      ]}))
      .mockResolvedValueOnce(reply({status: '1', count: '1', pois: [restaurant]}));
    const search = createDiscoveryProvider('key', upstream);
    const result = await search(discoveryQuery.parse({kind: 'text', city: '澳门'}));
    expect(result.items.map(item => item.id)).toEqual(['B000000001', 'B000000002']);
    await expect(search({kind: 'detail', id: 'B000000002'})).resolves.toMatchObject({items: []});
  });
});
