import {createClient} from '@supabase/supabase-js';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {mapCanonicalPlaceToShop} from '@/lib/mappers/canonical-shop';
import {isMissingRelationError} from '@/lib/supabase/errors';

export async function GET() {
  const requestId = createRequestId();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Public database configuration is missing.', status: 500},
      requestId
    );
  }

  const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  const {data, error} = await client
    .from('places')
    .select(
      'id,name,address,category_slug,region,longitude,latitude,price_per_person,rating_average,review_count,status,legacy_image_urls,place_tags(tags(id,slug,label_zh_mo)),place_media(id,bucket_id,storage_path,sort_order,lifecycle_status)'
    )
    .eq('status', 'published')
    .order('confidence_score', {ascending: false, nullsFirst: false})
    .limit(500);

  if (error) {
    if (isMissingRelationError(error)) {
      return successResponse({items: [], canonicalAvailable: false}, {requestId});
    }
    console.error(`[${requestId}] canonical places query failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load canonical places.', status: 500},
      requestId
    );
  }

  const items = (data ?? []).map((rawRow) => {
    const row = rawRow as unknown as Parameters<typeof mapCanonicalPlaceToShop>[0];
    const media = (rawRow.place_media ?? []).map((item) => {
      const publicUrl = item.bucket_id === 'place-media'
        ? client.storage.from('place-media').getPublicUrl(item.storage_path).data.publicUrl
        : null;
      return {...item, public_url: publicUrl};
    });
    return mapCanonicalPlaceToShop({...row, place_media: media});
  });

  return successResponse({items, canonicalAvailable: true}, {requestId});
}
