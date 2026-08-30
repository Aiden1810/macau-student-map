import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {rejectSubmissionSchema} from '@/lib/domain/moderation';

type RouteContext = {params: Promise<{id: string}>};

export async function POST(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireAdmin(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);
  const body = await parseJsonBody(request, rejectSubmissionSchema);
  if (!body.ok) return errorResponse(body.error, requestId);
  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client.rpc('reject_place_submission', {
    p_submission_id: id,
    p_review_note: body.data.reviewNote
  });
  if (error || !data) {
    console.error(`[${requestId}] reject submission failed:`, error?.message);
    return errorResponse({code: 'CONFLICT', message: error?.message ?? 'Rejection failed.', status: 409}, requestId);
  }
  return successResponse({submissionId: id, rejected: true}, {requestId});
}
