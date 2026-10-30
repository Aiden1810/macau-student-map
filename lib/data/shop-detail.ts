import type {Shop} from '../../types/shop';

export type ShopSource = 'canonical';

export type CanonicalPlaceResult = {
  ok: boolean;
  status: number;
  shop: Shop | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ShopDetailDecision =
  | {kind: 'use-shop'; shop: Shop; source: ShopSource}
  | {kind: 'not-found'}
  | {kind: 'load-error'; message: string};

export type CanonicalPlaceLoader = (shopId: string) => Promise<CanonicalPlaceResult>;

/**
 * Classify a canonical `/api/places/[id]` result into a shop-detail decision.
 * A real "place does not exist" answer requires both the HTTP 404 status and
 * the NOT_FOUND error code; anything ambiguous (unknown 404, non-JSON 404,
 * missing route, other error codes) must surface as a load error instead of a
 * false not-found.
 */
export function decideCanonicalDetailResult(canonical: CanonicalPlaceResult): ShopDetailDecision {
  if (canonical.ok && canonical.shop) {
    return {kind: 'use-shop', shop: canonical.shop, source: 'canonical'};
  }

  if (canonical.status === 404 && canonical.errorCode === 'NOT_FOUND') {
    return {kind: 'not-found'};
  }

  if (canonical.errorCode === 'SCHEMA_UNAVAILABLE') {
    return {kind: 'load-error', message: '地点数据系统暂不可用，请稍后再试'};
  }

  return {kind: 'load-error', message: canonical.errorMessage ?? '店铺加载失败'};
}

/** Details use the same published-place source as discovery and reviews. */
export async function loadShopDetail(
  shopId: string,
  loadCanonicalPlace: CanonicalPlaceLoader
): Promise<ShopDetailDecision> {
  if (!shopId) return {kind: 'load-error', message: '店铺 ID 无效'};
  try {
    return decideCanonicalDetailResult(await loadCanonicalPlace(shopId));
  } catch {
    return {kind: 'load-error', message: '店铺加载失败，请稍后再试'};
  }
}
