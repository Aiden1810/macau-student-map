import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {getPublicLegacyShops} from '@/lib/data/public-legacy-shops';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestId = createRequestId();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response: Response;
  try {
    if (!url || !key) throw new Error('Missing public database configuration.');
    response = successResponse({items: await getPublicLegacyShops(url, key)}, {requestId});
  } catch {
    response = errorResponse({code: 'INTERNAL_ERROR', message: 'Unable to load public shops.', status: 500}, requestId);
  }
  response.headers.set('cache-control', 'no-store');
  return response;
}
