import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {getPublicPlaces} from '@/lib/data/public-places';
import {isMissingRelationError} from '@/lib/supabase/errors';
import {instrumentApi} from '@/lib/observability/context';

// Keep response/request ids fresh. Only the anonymous database result is shared.
export const dynamic = 'force-dynamic';

export const GET = instrumentApi('places.list',handleGet);
async function handleGet() {
  const response = await loadResponse();
  response.headers.set('cache-control', 'no-store');
  return response;
}

async function loadResponse() {
  const requestId = createRequestId();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Public database configuration is missing.', status: 500},
      requestId
    );
  }

  try {
    const items = await getPublicPlaces(url, key);
    return successResponse({items, canonicalAvailable: true}, {requestId});
  } catch (error) {
    if (isMissingRelationError(error as {code?: string; message?: string})) {
      return successResponse({items: [], canonicalAvailable: false}, {requestId});
    }
    console.error(`[${requestId}] canonical places query failed:`, (error as {message?: string})?.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load canonical places.', status: 500},
      requestId
    );
  }

}
