import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {approveSubmissionSchema} from '@/lib/domain/moderation';
import {transferApprovedSubmissionMedia} from '@/lib/services/media';

type RouteContext = {params: Promise<{id: string}>};

export async function POST(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireAdmin(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);
  const body = await parseJsonBody(request, approveSubmissionSchema);
  if (!body.ok) return errorResponse(body.error, requestId);
  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: placeId, error} = await client.rpc('approve_place_submission', {
    p_submission_id: id,
    p_target_place_id: null,
    p_review_note: body.data.reviewNote
  });
  if (error || !placeId) {
    console.error(`[${requestId}] approve submission failed:`, error?.message);
    return errorResponse({code: 'CONFLICT', message: error?.message ?? 'Approval failed.', status: 409}, requestId);
  }
  const mediaWarnings = await transferApprovedSubmissionMedia(client, id, String(placeId));
  return successResponse({submissionId: id, placeId: String(placeId), mediaWarnings}, {requestId});
}
