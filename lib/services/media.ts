import type {SupabaseClient} from '@supabase/supabase-js';
import {IMAGE_MIME_EXTENSIONS, type AllowedImageMime} from '../storage/object-path';

export type MediaTransferWarning = {mediaId: string; message: string};

export async function transferApprovedSubmissionMedia(
  client: SupabaseClient,
  submissionId: string,
  placeId: string
): Promise<MediaTransferWarning[]> {
  const warnings: MediaTransferWarning[] = [];
  const {data: mediaRows, error} = await client
    .from('place_media')
    .select('id,storage_path,mime_type')
    .eq('submission_id', submissionId)
    .eq('bucket_id', 'submission-media');

  if (error) return [{mediaId: '*', message: error.message}];

  for (const media of mediaRows ?? []) {
    const mimeType = media.mime_type as AllowedImageMime;
    const extension = IMAGE_MIME_EXTENSIONS[mimeType];
    if (!extension) {
      warnings.push({mediaId: media.id, message: 'Unsupported stored MIME type.'});
      continue;
    }

    const {data: source, error: downloadError} = await client.storage
      .from('submission-media')
      .download(media.storage_path);
    if (downloadError || !source) {
      warnings.push({mediaId: media.id, message: downloadError?.message ?? 'Download failed.'});
      continue;
    }

    const targetPath = `${placeId}/${crypto.randomUUID()}.${extension}`;
    const {error: uploadError} = await client.storage
      .from('place-media')
      .upload(targetPath, source, {contentType: mimeType, upsert: false, cacheControl: '86400'});
    if (uploadError) {
      warnings.push({mediaId: media.id, message: uploadError.message});
      continue;
    }

    const {error: updateError} = await client
      .from('place_media')
      .update({
        place_id: placeId,
        submission_id: null,
        bucket_id: 'place-media',
        storage_path: targetPath,
        lifecycle_status: 'ready'
      })
      .eq('id', media.id);

    if (updateError) {
      await client.storage.from('place-media').remove([targetPath]);
      warnings.push({mediaId: media.id, message: updateError.message});
      continue;
    }

    const {error: cleanupError} = await client.storage
      .from('submission-media')
      .remove([media.storage_path]);
    if (cleanupError) {
      warnings.push({mediaId: media.id, message: `Private source cleanup pending: ${cleanupError.message}`});
    }
  }

  return warnings;
}
