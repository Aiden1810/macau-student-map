import {describe, expect, it, vi} from 'vitest';
import {
  canManageLegacyImages,
  decideCanonicalDetailResult,
  loadShopDetail
} from '../../../lib/data/shop-detail';
import type {CanonicalPlaceResult, LegacyShopResult} from '../../../lib/data/shop-detail';
import type {Shop} from '../../../types/shop';

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-1',
    name: '测试店铺',
    address: '澳门',
    imageUrls: [],
    type: '餐饮',
    category: 'food',
    coordinates: [113.55, 22.19],
    hasCoordinates: true,
    studentDiscount: null,
    tags: [],
    features: [],
    shopType: '全部',
    ratingLabel: '暂无评分',
    rating: 0,
    reviews: 0,
    recommendStatus: 'neutral',
    status: 'verified',
    ...overrides
  };
}

function canonicalResult(overrides: Partial<CanonicalPlaceResult> = {}): CanonicalPlaceResult {
  return {ok: false, status: 0, shop: null, errorCode: null, errorMessage: null, ...overrides};
}

function legacyResult(overrides: Partial<LegacyShopResult> = {}): LegacyShopResult {
  return {shop: null, errorMessage: null, ...overrides};
}

describe('decideCanonicalDetailResult', () => {
  it('returns the canonical shop on success', () => {
    const shop = makeShop({id: 'place-1'});
    expect(decideCanonicalDetailResult(canonicalResult({ok: true, status: 200, shop}))).toEqual({
      kind: 'use-shop',
      shop,
      source: 'canonical'
    });
  });

  it('returns not-found only when the HTTP status is 404 and the code is NOT_FOUND', () => {
    expect(decideCanonicalDetailResult(canonicalResult({status: 404, errorCode: 'NOT_FOUND'}))).toEqual({
      kind: 'not-found'
    });
  });

  it('returns a schema load-error for SCHEMA_UNAVAILABLE regardless of HTTP status', () => {
    expect(decideCanonicalDetailResult(canonicalResult({status: 503, errorCode: 'SCHEMA_UNAVAILABLE'}))).toEqual({
      kind: 'load-error',
      message: '地点数据系统暂不可用，请稍后再试'
    });
    expect(decideCanonicalDetailResult(canonicalResult({status: 404, errorCode: 'SCHEMA_UNAVAILABLE'}))).toEqual({
      kind: 'load-error',
      message: '地点数据系统暂不可用，请稍后再试'
    });
  });

  it('never treats an unknown 404 as not-found', () => {
    expect(decideCanonicalDetailResult(canonicalResult({status: 404, errorCode: null}))).toEqual({
      kind: 'load-error',
      message: '店铺加载失败'
    });
    expect(decideCanonicalDetailResult(canonicalResult({status: 404, errorCode: 'FORBIDDEN'}))).toEqual({
      kind: 'load-error',
      message: '店铺加载失败'
    });
  });

  it('preserves explicit network and INTERNAL_ERROR messages', () => {
    expect(
      decideCanonicalDetailResult(canonicalResult({status: 0, errorMessage: '网络错误'}))
    ).toEqual({kind: 'load-error', message: '网络错误'});
    expect(
      decideCanonicalDetailResult(canonicalResult({status: 500, errorCode: 'INTERNAL_ERROR', errorMessage: 'Unable to load the place.'}))
    ).toEqual({kind: 'load-error', message: 'Unable to load the place.'});
  });
});

describe('loadShopDetail', () => {
  it('turns a rejected legacy request into a load error without falling back', async () => {
    const canonical = vi.fn();
    const result = await loadShopDetail('shop-1', async () => {
      throw new Error('Network unavailable');
    }, canonical);
    expect(result).toEqual({kind: 'load-error', message: '店铺加载失败，请稍后再试'});
    expect(canonical).not.toHaveBeenCalled();
  });

  it('turns a rejected canonical request into a load error', async () => {
    const result = await loadShopDetail('place-1', async () => legacyResult(), async () => {
      throw new Error('Network unavailable');
    });
    expect(result).toEqual({kind: 'load-error', message: '店铺加载失败，请稍后再试'});
  });

  it('uses the legacy shop without calling the canonical loader when legacy succeeds', async () => {
    const legacy = makeShop({id: 'legacy-1'});
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult({shop: legacy}));
    const loadCanonicalPlace = vi.fn();

    const decision = await loadShopDetail('legacy-1', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'use-shop', shop: legacy, source: 'legacy'});
    expect(loadCanonicalPlace).toHaveBeenCalledTimes(0);
  });

  it('returns load-error without calling the canonical loader when legacy errors', async () => {
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult({errorMessage: 'relation shops does not exist'}));
    const loadCanonicalPlace = vi.fn();

    const decision = await loadShopDetail('shop-1', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'load-error', message: 'relation shops does not exist'});
    expect(loadCanonicalPlace).toHaveBeenCalledTimes(0);
  });

  it('calls the canonical loader exactly once on an exact legacy miss', async () => {
    const canonical = makeShop({id: 'place-1', name: '城大影印中心'});
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult());
    const loadCanonicalPlace = vi.fn().mockResolvedValue(
      canonicalResult({ok: true, status: 200, shop: canonical})
    );

    const decision = await loadShopDetail('place-1', loadLegacyShop, loadCanonicalPlace);

    expect(loadCanonicalPlace).toHaveBeenCalledTimes(1);
    expect(loadCanonicalPlace).toHaveBeenCalledWith('place-1');
    expect(decision).toEqual({kind: 'use-shop', shop: canonical, source: 'canonical'});
  });

  it('returns not-found when the canonical place is an exact NOT_FOUND', async () => {
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult());
    const loadCanonicalPlace = vi.fn().mockResolvedValue(
      canonicalResult({status: 404, errorCode: 'NOT_FOUND', errorMessage: 'Published place not found.'})
    );

    const decision = await loadShopDetail('place-1', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'not-found'});
    expect(loadCanonicalPlace).toHaveBeenCalledTimes(1);
  });

  it('returns a schema load-error when the canonical schema is unavailable', async () => {
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult());
    const loadCanonicalPlace = vi.fn().mockResolvedValue(
      canonicalResult({status: 503, errorCode: 'SCHEMA_UNAVAILABLE'})
    );

    const decision = await loadShopDetail('place-1', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'load-error', message: '地点数据系统暂不可用，请稍后再试'});
    expect(loadCanonicalPlace).toHaveBeenCalledTimes(1);
  });

  it('does not return not-found for an unknown canonical 404', async () => {
    const loadLegacyShop = vi.fn().mockResolvedValue(legacyResult());
    const loadCanonicalPlace = vi.fn().mockResolvedValue(canonicalResult({status: 404, errorCode: null}));

    const decision = await loadShopDetail('place-1', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'load-error', message: '店铺加载失败'});
  });

  it('rejects an empty shop id without calling either loader', async () => {
    const loadLegacyShop = vi.fn();
    const loadCanonicalPlace = vi.fn();

    const decision = await loadShopDetail('', loadLegacyShop, loadCanonicalPlace);

    expect(decision).toEqual({kind: 'load-error', message: '店铺 ID 无效'});
    expect(loadLegacyShop).not.toHaveBeenCalled();
    expect(loadCanonicalPlace).not.toHaveBeenCalled();
  });
});

describe('canManageLegacyImages', () => {
  it('allows admins to manage images for legacy shops', () => {
    expect(canManageLegacyImages('admin', 'legacy')).toBe(true);
  });

  it('never enables the legacy image manager for canonical-only places', () => {
    expect(canManageLegacyImages('admin', 'canonical')).toBe(false);
    expect(canManageLegacyImages(null, 'canonical')).toBe(false);
  });

  it('requires the admin role even for legacy shops', () => {
    expect(canManageLegacyImages(null, 'legacy')).toBe(false);
    expect(canManageLegacyImages('user', 'legacy')).toBe(false);
  });

  it('does not grant access before the shop source is resolved', () => {
    expect(canManageLegacyImages('admin', null)).toBe(false);
  });
});
