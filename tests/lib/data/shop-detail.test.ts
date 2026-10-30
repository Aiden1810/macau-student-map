import {describe, expect, it} from 'vitest';
import {loadShopDetail} from '../../../lib/data/shop-detail';
import type {CanonicalPlaceResult} from '../../../lib/data/shop-detail';
import type {Shop} from '../../../types/shop';
const shop = {id: 'place-1', name: '当前地点', status: 'verified'} as Shop;
const result = (input: Partial<CanonicalPlaceResult>): CanonicalPlaceResult => ({
  ok: false, status: 0, shop: null, errorCode: null, errorMessage: null, ...input
});
describe('single-source place details', () => {
  it('loads the current published record without a legacy fallback', async () => {
    expect(await loadShopDetail(shop.id, async () => result({ok: true, status: 200, shop})))
      .toEqual({kind: 'use-shop', shop, source: 'canonical'});
  });
  it('keeps an unpublished or archived record unavailable', async () => {
    expect(await loadShopDetail(shop.id, async () => result({status: 404, errorCode: 'NOT_FOUND'})))
      .toEqual({kind: 'not-found'});
  });
  it.each([0, 404, 500, 503])('reports ambiguous HTTP %s as a load error', async status => {
    expect((await loadShopDetail(shop.id, async () => result({status}))).kind).toBe('load-error');
  });
  it('reports transport failure instead of searching another table', async () => {
    expect((await loadShopDetail(shop.id, async () => {throw new Error('offline');})).kind).toBe('load-error');
  });
  it('does not access the database for an empty identifier', async () => {
    let accessed = false;
    expect((await loadShopDetail('', async () => {accessed = true; return result({});})).kind).toBe('load-error');
    expect(accessed).toBe(false);
  });
});
