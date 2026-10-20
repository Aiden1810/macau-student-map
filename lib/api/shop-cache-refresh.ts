import {createAdminPlaceRoute, createAdminRoute} from '../admin/api';
import {successResponse} from './result';

/** Browser-side legacy writes notify this endpoint; authorization is checked again on the server. */
export function createShopCacheRefreshRoute(dependencies?: Parameters<typeof createAdminRoute>[1]) {
  return createAdminPlaceRoute<Record<string, never>>(async () => successResponse({refreshed: true}), dependencies);
}
