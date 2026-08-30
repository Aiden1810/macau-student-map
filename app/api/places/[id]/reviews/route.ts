import {createClient} from '@supabase/supabase-js';
import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {mapReviewRow} from '@/lib/data/review-repository';
import {reviewInputSchema} from '@/lib/domain/review';
import {prepareReviewUpsert} from '@/lib/services/reviews';

const REVIEW_COLUMNS = 'id,place_id,user_id,rating,content,status,created_at,updated_at';
type RouteContext = {params: Promise<{id: string}>};

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing public Supabase configuration.');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}
export async function GET(_request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const {id: placeId} = await params;
  const client = createPublicClient();
  const {data, error} = await client
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('place_id', placeId)
    .eq('status', 'published')
    .order('created_at', {ascending: false})
    .limit(100);

  if (error) {
    console.error(`[${requestId}] list reviews failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load reviews.', status: 500},
      requestId
    );
  }
  return successResponse({items: (data ?? []).map(mapReviewRow)}, {requestId});
}

export async function POST(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const body = await parseJsonBody(request, reviewInputSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const {id: placeId} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: place, error: placeError} = await client
    .from('places')
    .select('id')
    .eq('id', placeId)
    .eq('status', 'published')
    .maybeSingle();

  if (placeError) {
    console.error(`[${requestId}] review place lookup failed:`, placeError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to validate the place.', status: 500},
      requestId
    );
  }
  if (!place) {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'Published place not found.', status: 404},
      requestId
    );
  }

  const {data, error} = await client
    .from('reviews')
    .upsert(prepareReviewUpsert(body.data, placeId, auth.user.id), {
      onConflict: 'user_id,place_id'
    })
    .select(REVIEW_COLUMNS)
    .single();

  if (error || !data) {
    console.error(`[${requestId}] upsert review failed:`, error?.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to save the review.', status: 500},
      requestId
    );
  }
  return successResponse(mapReviewRow(data), {status: 201, requestId});
}
