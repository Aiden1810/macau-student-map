import {placeSubmissionDraftSchema} from '@/lib/domain/submission';
import {mapSubmissionRow, toDraftRow} from '@/lib/data/submission-repository';
import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';

const SUBMISSION_COLUMNS =
  'id,source_place_id,merged_into_place_id,name,address,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,status,submitted_by,version,submitted_at,reviewed_at,review_note,created_at,updated_at';

export async function GET(request: Request) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client
    .from('place_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('submitted_by', auth.user.id)
    .order('created_at', {ascending: false});

  if (error) {
    console.error(`[${requestId}] list submissions failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load submissions.', status: 500},
      requestId
    );
  }

  return successResponse({items: (data ?? []).map(mapSubmissionRow)}, {requestId});
}
export async function POST(request: Request) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const body = await parseJsonBody(request, placeSubmissionDraftSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client
    .from('place_submissions')
    .insert(toDraftRow(body.data, auth.user.id))
    .select(SUBMISSION_COLUMNS)
    .single();

  if (error || !data) {
    console.error(`[${requestId}] create submission failed:`, error?.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to create the submission draft.', status: 500},
      requestId
    );
  }

  return successResponse(mapSubmissionRow(data), {status: 201, requestId});
}
