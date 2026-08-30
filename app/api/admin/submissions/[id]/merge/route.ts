import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {mergeSubmissionSchema} from '@/lib/domain/moderation';
import {transferApprovedSubmissionMedia} from '@/lib/services/media';

type RouteContext = {params: Promise<{id: string}>};

export async function POST(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireAdmin(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);
  const body = await parseJsonBody(request, mergeSubmissionSchema);
  if (!body.ok) return errorResponse(body.error, requestId);
  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: placeId, error} = await client.rpc('merge_place_submission', {
    p_submission_id: id,
    p_target_place_id: body.data.targetPlaceId,
    p_review_note: body.data.reviewNote
  });
  if (error || !placeId) {
    console.error(`[${requestId}] merge submission failed:`, error?.message);
    return errorResponse({code: 'CONFLICT', message: error?.message ?? 'Merge failed.', status: 409}, requestId);
  }
  const mediaWarnings = await transferApprovedSubmissionMedia(client, id, String(placeId));
  return successResponse({submissionId: id, placeId: String(placeId), mediaWarnings}, {requestId});
}
