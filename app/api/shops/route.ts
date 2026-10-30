import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {getPublicPlaces} from '@/lib/data/public-places';
import {instrumentApi} from '@/lib/observability/context';
import {toLegacyShopResponse} from '@/lib/mappers/legacy-shop-response';

export const dynamic = 'force-dynamic';

export const GET = instrumentApi('shops.list',handleGet);
async function handleGet() {
  const requestId = createRequestId();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response: Response;
  try {
    if (!url || !key) throw new Error('Missing public database configuration.');
    // Preserve old HTTP clients without retaining a second database source.
    response = successResponse({items: (await getPublicPlaces(url, key)).map(toLegacyShopResponse)}, {requestId});
  } catch {
    response = errorResponse({code: 'INTERNAL_ERROR', message: 'Unable to load public shops.', status: 500}, requestId);
  }
  response.headers.set('cache-control', 'no-store');
  return response;
}
