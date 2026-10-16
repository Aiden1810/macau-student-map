import type {SupabaseClient} from '@supabase/supabase-js';
import {IMAGE_MIME_EXTENSIONS, type AllowedImageMime} from '../storage/object-path';

export type MediaTransferWarning = {mediaId: string; message: string};

// Persist the cleanup phase before deleting a public copy, including the short
// interval between copying it and the transfer worker marking its source.
export async function markTransferredSourceForCleanup(client: SupabaseClient, placeId: string, path: string) {
  const [folder, filename, extra] = path.split('/');
  const sourceId = filename?.split('.')[0];
  if (folder !== placeId || extra || !sourceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) return;
  const {data: source, error} = await client.from('place_media').select('id,submission_id')
    .eq('id', sourceId).eq('bucket_id', 'submission-media').maybeSingle();
  if (error) throw error;
  if (!source?.submission_id) return;
  const {data: submission, error: submissionError} = await client.from('place_submissions').select('id')
    .eq('id', source.submission_id).eq('published_place_id', placeId).maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) return;
  const {error: updateError} = await client.from('place_media').update({lifecycle_status: 'cleanup_pending'}).eq('id', source.id);
  if (updateError) throw updateError;
}

export async function transferApprovedSubmissionMedia(
  client: SupabaseClient,
  submissionId: string,
  placeId: string
): Promise<MediaTransferWarning[]> {
  const warnings: MediaTransferWarning[] = [];
  const {data: mediaRows, error} = await client
    .from('place_media')
    .select('id,storage_path,mime_type,byte_size,uploaded_by,sort_order,alt_text,lifecycle_status')
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

    // A stable target lets retries find a completed copy while retaining the
    // private source association until its storage object is actually removed.
    const targetPath = `${placeId}/${media.id}.${extension}`;
    const findCopy = () => client.from('place_media').select('id')
      .eq('bucket_id', 'place-media').eq('storage_path', targetPath).maybeSingle();
    const cleanupOnly = media.lifecycle_status === 'cleanup_pending' || media.lifecycle_status === 'delete_failed';
    const {data: existing, error: lookupError} = cleanupOnly ? {data: null, error: null} : await findCopy();
    if (lookupError) {warnings.push({mediaId: media.id, message: lookupError.message}); continue;}
    if (!cleanupOnly && !existing) {
      const {data: source, error: downloadError} = await client.storage.from('submission-media').download(media.storage_path);
      if (downloadError || !source) {
        warnings.push({mediaId: media.id, message: downloadError?.message ?? 'Download failed.'}); continue;
      }
      const {error: uploadError} = await client.storage.from('place-media')
        .upload(targetPath, source, {contentType: mimeType, upsert: true, cacheControl: '86400'});
      if (uploadError) {
        warnings.push({mediaId: media.id, message: uploadError.message}); continue;
      }
      const {error: insertError} = await client.from('place_media').insert({
        place_id: placeId, submission_id: null, bucket_id: 'place-media', storage_path: targetPath,
        uploaded_by: media.uploaded_by, mime_type: mimeType, byte_size: media.byte_size,
        sort_order: media.sort_order, alt_text: media.alt_text, lifecycle_status: 'ready'
      });
      if (insertError) {
        // Do not delete a concurrent worker's successfully associated copy.
        const copy = await findCopy();
        if (!copy.data) {
          await client.storage.from('place-media').remove([targetPath]);
          warnings.push({mediaId: media.id, message: insertError.message}); continue;
        }
      }
    }

    const {error: markError} = await client.from('place_media').update({lifecycle_status: 'cleanup_pending'}).eq('id', media.id);
    if (markError) {warnings.push({mediaId: media.id, message: markError.message}); continue;}

    const {error: cleanupError} = await client.storage
      .from('submission-media')
      .remove([media.storage_path]);
    if (cleanupError) {
      await client.from('place_media').update({lifecycle_status: 'delete_failed'}).eq('id', media.id);
      warnings.push({mediaId: media.id, message: `Private source cleanup pending: ${cleanupError.message}`});
      continue;
    }
    const {error: deleteError} = await client.from('place_media').delete().eq('id', media.id);
    if (deleteError) warnings.push({mediaId: media.id, message: deleteError.message});
  }

  return warnings;
}
