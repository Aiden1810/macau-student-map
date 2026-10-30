import {readLocationDetails} from '../domain/location-details';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AdminPlaceInput, AdminPlaceRecord, EditorMedia, SubmissionEditorRecord} from './place-editor';
import {readAccountEmails} from './accounts';

export const ADMIN_PLACE_COLUMNS = 'id,name,name_en,address,location_details,category_slug,region,longitude,latitude,price_per_person,status,created_at,updated_at,created_by,search_keywords_manual,legacy_image_urls,place_tags(tag_id),place_media(id,bucket_id,storage_path,sort_order,lifecycle_status)';
type MediaRow = {id: string; bucket_id: string; storage_path: string; sort_order: number; lifecycle_status: string};
type PlaceRow = {
  id: string; name: string; name_en: string | null; address: string | null; location_details?: unknown;
  category_slug: AdminPlaceInput['categorySlug']; region: AdminPlaceInput['region'];
  longitude: number | null; latitude: number | null; price_per_person: number | null;
  status: AdminPlaceInput['status']; updated_at: string; search_keywords_manual: string[];
  place_tags: {tag_id: string}[]; place_media: MediaRow[];
  legacy_image_urls?: string[];
  created_by?: string | null;
  created_at?: string;
};

export async function editorMedia(client: SupabaseClient, rows: MediaRow[]): Promise<EditorMedia[]> {
  return Promise.all(rows.filter(row => ['uploaded', 'ready'].includes(row.lifecycle_status))
    .sort((a, b) => a.sort_order - b.sort_order).map(async row => {
      if (row.bucket_id === 'place-media') return {
        id: row.id, url: client.storage.from('place-media').getPublicUrl(row.storage_path).data.publicUrl, sortOrder: row.sort_order
      };
      const {data, error} = await client.storage.from(row.bucket_id).createSignedUrl(row.storage_path, 300);
      return {id: row.id, url: data?.signedUrl ?? null, sortOrder: row.sort_order,
        ...(error ? {previewError: '图片预览暂不可用，请刷新重试'} : {})};
    }));
}

export async function mapAdminPlace(client: SupabaseClient, row: PlaceRow, accounts: Map<string, string | null>): Promise<AdminPlaceRecord> {
  return {id: row.id, createdAt: row.created_at ?? null, updatedAt: row.updated_at, name: row.name, nameEn: row.name_en, address: row.address, locationDetails: readLocationDetails(row.location_details),
    categorySlug: row.category_slug, region: row.region, longitude: row.longitude, latitude: row.latitude,
    pricePerPerson: row.price_per_person === null ? null : Number(row.price_per_person),
    createdBy: row.created_by ? {id: row.created_by, email: accounts.get(row.created_by) ?? null} : null,
    tagIds: row.place_tags.map(tag => tag.tag_id), searchKeywords: row.search_keywords_manual ?? [], status: row.status,
    media: [...await editorMedia(client, row.place_media ?? []), ...(row.legacy_image_urls ?? []).map((url, index) => ({id: `legacy:${url}`, url, sortOrder: 1000 + index}))]};
}

export async function loadAdminPlace(client: SupabaseClient, id: string) {
  const {data, error} = await client.from('places').select(ADMIN_PLACE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const accounts = await readAccountEmails(client, [data.created_by]);
  const record = await mapAdminPlace(client, data as unknown as PlaceRow, accounts);
  record.pendingSubmissionIds = await pendingPlaceSubmissions(client, id);
  return record;
}

export async function pendingPlaceSubmissions(client: SupabaseClient, placeId: string): Promise<string[]> {
  const {data: submissions, error} = await client.from('place_submissions').select('id')
    .eq('published_place_id', placeId).eq('status', 'approved');
  if (error) throw error;
  if (!submissions?.length) return [];
  const {data: media, error: mediaError} = await client.from('place_media').select('submission_id')
    .in('submission_id', submissions.map(row => row.id)).eq('bucket_id', 'submission-media');
  if (mediaError) throw mediaError;
  return [...new Set((media ?? []).map(row => row.submission_id as string))];
}

export async function loadSubmissionEditor(client: SupabaseClient, id: string): Promise<SubmissionEditorRecord | null> {
  const {data: row, error} = await client.from('place_submissions')
    .select('id,name,address,location_details,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,version,status')
    .eq('id', id).eq('status', 'pending').maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const {data: media, error: mediaError} = await client.from('place_media')
    .select('id,bucket_id,storage_path,sort_order,lifecycle_status').eq('submission_id', id);
  if (mediaError) throw mediaError;
  return {id: row.id, name: row.name, nameEn: null, address: row.address, locationDetails: readLocationDetails(row.location_details),
    categorySlug: row.category_slug, region: row.region, longitude: row.longitude, latitude: row.latitude,
    pricePerPerson: row.price_per_person === null ? null : Number(row.price_per_person), tagIds: row.tag_ids,
    searchKeywords: [], status: 'published', version: row.version, notes: row.notes,
    media: await editorMedia(client, media ?? [])};
}
