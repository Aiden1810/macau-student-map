import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {createSubmissionObjectPath, validateImageUpload} from '@/lib/storage/object-path';

export async function POST(request: Request) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      {code: 'INVALID_JSON', message: 'A valid multipart form is required.', status: 400},
      requestId
    );
  }

  const file = formData.get('file');
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const altText = String(formData.get('altText') ?? '').trim().slice(0, 300) || null;
  if (!(file instanceof File) || !submissionId) {
    return errorResponse(
      {
        code: 'VALIDATION_ERROR',
        message: 'file and submissionId are required.',
        status: 422
      },
      requestId
    );
  }

  let mimeType: ReturnType<typeof validateImageUpload>;
  let storagePath: string;
  try {
    mimeType = validateImageUpload(file);
    storagePath = createSubmissionObjectPath(auth.user.id, submissionId, mimeType);
  } catch (error) {
    return errorResponse(
      {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid image.',
        status: 422
      },
      requestId
    );
  }

  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: draft, error: draftError} = await client
    .from('place_submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .maybeSingle();

  if (draftError) {
    console.error(`[${requestId}] media parent lookup failed:`, draftError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to validate the draft.', status: 500},
      requestId
    );
  }
  if (!draft) {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'An editable draft was not found.', status: 404},
      requestId
    );
  }

  const {error: uploadError} = await client.storage
    .from('submission-media')
    .upload(storagePath, file, {contentType: mimeType, cacheControl: '3600', upsert: false});

  if (uploadError) {
    console.error(`[${requestId}] storage upload failed:`, uploadError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to upload the image.', status: 500},
      requestId
    );
  }

  const {data: media, error: metadataError} = await client
    .from('place_media')
    .insert({
      submission_id: submissionId,
      place_id: null,
      uploaded_by: auth.user.id,
      bucket_id: 'submission-media',
      storage_path: storagePath,
      mime_type: mimeType,
      byte_size: file.size,
      alt_text: altText,
      lifecycle_status: 'uploaded'
    })
    .select('id,submission_id,bucket_id,storage_path,mime_type,byte_size,alt_text,sort_order,lifecycle_status')
    .single();

  if (metadataError || !media) {
    const {error: cleanupError} = await client.storage.from('submission-media').remove([storagePath]);
    if (cleanupError) {
      console.error(`[${requestId}] compensating media cleanup failed:`, cleanupError.message);
    }
    console.error(`[${requestId}] media metadata insert failed:`, metadataError?.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to save image metadata.', status: 500},
      requestId
    );
  }

  return successResponse(media, {status: 201, requestId});
}
