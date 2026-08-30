import {placeSubmissionDraftSchema} from '@/lib/domain/submission';
import {mapSubmissionRow, toDraftRow} from '@/lib/data/submission-repository';
import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';

const SUBMISSION_COLUMNS =
  'id,source_place_id,merged_into_place_id,name,address,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,status,submitted_by,version,submitted_at,reviewed_at,review_note,created_at,updated_at';

type RouteContext = {params: Promise<{id: string}>};

export async function PATCH(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const body = await parseJsonBody(request, placeSubmissionDraftSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const nextVersion = body.data.version + 1;
  const {data, error} = await client
    .from('place_submissions')
    .update({...toDraftRow(body.data, auth.user.id), version: nextVersion})
    .eq('id', id)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .eq('version', body.data.version)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error(`[${requestId}] update submission failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to update the submission draft.', status: 500},
      requestId
    );
  }
  if (!data) {
    return errorResponse(
      {
        code: 'CONFLICT',
        message: 'The draft changed, was submitted, or is not owned by this account.',
        status: 409
      },
      requestId
    );
  }

  return successResponse(mapSubmissionRow(data), {requestId});
}

export async function DELETE(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: draft, error: draftError} = await client
    .from('place_submissions')
    .select('id')
    .eq('id', id)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .maybeSingle();

  if (draftError) {
    console.error(`[${requestId}] draft lookup before delete failed:`, draftError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load the draft.', status: 500},
      requestId
    );
  }
  if (!draft) {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'An editable draft was not found.', status: 404},
      requestId
    );
  }

  const {data: mediaRows, error: mediaError} = await client
    .from('place_media')
    .select('id,storage_path,bucket_id')
    .eq('submission_id', id)
    .eq('uploaded_by', auth.user.id);

  if (mediaError) {
    console.error(`[${requestId}] draft media lookup failed:`, mediaError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to inspect draft images.', status: 500},
      requestId
    );
  }

  const mediaIds = (mediaRows ?? []).map((media) => media.id);
  if (mediaIds.length > 0) {
    await client.from('place_media').update({lifecycle_status: 'cleanup_pending'}).in('id', mediaIds);
  }
  const paths = (mediaRows ?? [])
    .filter((media) => media.bucket_id === 'submission-media')
    .map((media) => media.storage_path);
  if (paths.length > 0) {
    const {error: storageError} = await client.storage.from('submission-media').remove(paths);
    if (storageError) {
      await client.from('place_media').update({lifecycle_status: 'delete_failed'}).in('id', mediaIds);
      console.error(`[${requestId}] draft storage cleanup failed:`, storageError.message);
      return errorResponse(
        {code: 'INTERNAL_ERROR', message: 'Draft image cleanup will be retried.', status: 500},
        requestId
      );
    }
  }

  const {data, error} = await client
    .from('place_submissions')
    .delete()
    .eq('id', id)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[${requestId}] delete submission failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to delete the draft.', status: 500},
      requestId
    );
  }
  if (!data) {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'An editable draft was not found.', status: 404},
      requestId
    );
  }

  return successResponse({id: data.id, deleted: true}, {requestId});
}
