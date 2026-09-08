import type {Shop} from '../../types/shop';

export type ShopSource = 'legacy' | 'canonical';

export type LegacyShopResult = {
  shop: Shop | null;
  errorMessage: string | null;
};

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

export type LegacyShopLoader = (shopId: string) => Promise<LegacyShopResult>;
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

/**
 * Orchestrate reading the legacy `shops` row first, then the canonical place
 * fallback. The canonical loader is only invoked on an exact legacy miss
 * (data === null && error === null); a legacy hit or legacy query failure is
 * decided immediately without touching the canonical API.
 */
export async function loadShopDetail(
  shopId: string,
  loadLegacyShop: LegacyShopLoader,
  loadCanonicalPlace: CanonicalPlaceLoader
): Promise<ShopDetailDecision> {
  if (!shopId) {
    return {kind: 'load-error', message: '店铺 ID 无效'};
  }

  try {
    const legacy = await loadLegacyShop(shopId);

    if (legacy.shop) {
      return {kind: 'use-shop', shop: legacy.shop, source: 'legacy'};
    }

    if (legacy.errorMessage) {
      return {kind: 'load-error', message: legacy.errorMessage};
    }

    const canonical = await loadCanonicalPlace(shopId);
    return decideCanonicalDetailResult(canonical);
  } catch {
    // Transport errors must also end loading; only a confirmed empty legacy
    // result permits the canonical fallback.
    return {kind: 'load-error', message: '店铺加载失败，请稍后再试'};
  }
}

/**
 * The legacy AdminImageManager writes to the `shops` table, so it must only be
 * reachable for legacy shops and requires the admin role. Canonical-only places
 * never get this entry point.
 */
export function canManageLegacyImages(userRole: string | null, source: ShopSource | null): boolean {
  return userRole === 'admin' && source === 'legacy';
}
