import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {mapReviewRow} from '@/lib/data/review-repository';
import {reviewInputSchema} from '@/lib/domain/review';

const REVIEW_COLUMNS = 'id,place_id,user_id,rating,content,status,created_at,updated_at';
type RouteContext = {params: Promise<{id: string}>};

export async function PATCH(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);
  const body = await parseJsonBody(request, reviewInputSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client
    .from('reviews')
    .update({rating: body.data.rating, content: body.data.content})
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select(REVIEW_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error(`[${requestId}] update review failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to update the review.', status: 500},
      requestId
    );
  }
  if (!data) {
    return errorResponse({code: 'NOT_FOUND', message: 'Owned review not found.', status: 404}, requestId);
  }
  return successResponse(mapReviewRow(data), {requestId});
}
export async function DELETE(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client
    .from('reviews')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[${requestId}] delete review failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to delete the review.', status: 500},
      requestId
    );
  }
  if (!data) {
    return errorResponse({code: 'NOT_FOUND', message: 'Owned review not found.', status: 404}, requestId);
  }
  return successResponse({id: data.id, deleted: true}, {requestId});
}
