import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {assertOwnedObjectPath} from '@/lib/storage/object-path';

type RouteContext = {params: Promise<{id: string}>};

export async function DELETE(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: media, error: lookupError} = await client
    .from('place_media')
    .select('id,submission_id,bucket_id,storage_path,uploaded_by,place_submissions!inner(status,submitted_by)')
    .eq('id', id)
    .eq('uploaded_by', auth.user.id)
    .eq('place_submissions.submitted_by', auth.user.id)
    .eq('place_submissions.status', 'draft')
    .maybeSingle();

  if (lookupError) {
    console.error(`[${requestId}] media lookup failed:`, lookupError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load the image.', status: 500},
      requestId
    );
  }
  if (!media || !media.submission_id || media.bucket_id !== 'submission-media') {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'An editable image was not found.', status: 404},
      requestId
    );
  }

  try {
    assertOwnedObjectPath(media.storage_path, auth.user.id, media.submission_id);
  } catch {
    return errorResponse(
      {code: 'FORBIDDEN', message: 'The image path is not owned by this account.', status: 403},
      requestId
    );
  }

  await client.from('place_media').update({lifecycle_status: 'cleanup_pending'}).eq('id', id);
  const {error: storageError} = await client.storage
    .from('submission-media')
    .remove([media.storage_path]);

  if (storageError) {
    await client.from('place_media').update({lifecycle_status: 'delete_failed'}).eq('id', id);
    console.error(`[${requestId}] storage delete failed:`, storageError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Image deletion will be retried.', status: 500},
      requestId
    );
  }

  const {error: rowError} = await client.from('place_media').delete().eq('id', id);
  if (rowError) {
    await client.from('place_media').update({lifecycle_status: 'delete_failed'}).eq('id', id);
    console.error(`[${requestId}] media row delete failed:`, rowError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Image metadata cleanup will be retried.', status: 500},
      requestId
    );
  }

  return successResponse({id, deleted: true}, {requestId});
}
