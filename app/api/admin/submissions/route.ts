import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {mapSubmissionRow} from '@/lib/data/submission-repository';

const COLUMNS = 'id,source_place_id,merged_into_place_id,name,address,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,status,submitted_by,version,submitted_at,reviewed_at,review_note,created_at,updated_at';

export async function GET(request: Request) {
  const requestId = createRequestId();
  const auth = await requireAdmin(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data, error} = await client
    .from('place_submissions')
    .select(COLUMNS)
    .eq('status', 'pending')
    .order('submitted_at', {ascending: true})
    .limit(200);
  if (error) {
    console.error(`[${requestId}] admin submission queue failed:`, error.message);
    return errorResponse({code: 'INTERNAL_ERROR', message: 'Unable to load the moderation queue.', status: 500}, requestId);
  }
  return successResponse({items: (data ?? []).map(mapSubmissionRow)}, {requestId});
}
