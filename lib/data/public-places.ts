import {createClient} from '@supabase/supabase-js';
import {unstable_cache} from 'next/cache';
import {mapCanonicalPlaceToShop} from '../mappers/canonical-shop';
import {PUBLIC_PLACES_CACHE_SECONDS, PUBLIC_PLACES_CACHE_TAG} from './public-places-cache';

/** Only anonymous published data belongs here: never use request cookies or an authenticated client. */
export async function getPublicPlaces(url: string, publicKey: string) {
  return unstable_cache(async () => {
    const client = createClient(url, publicKey, {
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
      // Cache the successful mapped result once, rather than maintaining a second fetch cache.
      global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store'})}
    });
    const {data, error} = await client.from('places').select(
      'id,name,address,location_details,category_slug,region,longitude,latitude,price_per_person,rating_average,review_count,status,published_at,legacy_image_urls,search_keywords_manual,place_tags(tags(id,slug,label_zh_mo)),place_media(id,bucket_id,storage_path,sort_order,lifecycle_status)'
    ).eq('status', 'published').order('confidence_score', {ascending: false, nullsFirst: false}).limit(500);
    // Throw so transient failures and missing-schema fallbacks are not stored as successful lists.
    if (error) throw error;
    return (data ?? []).map(rawRow => {
      const row = rawRow as unknown as Parameters<typeof mapCanonicalPlaceToShop>[0];
      const media = (rawRow.place_media ?? []).map(item => ({
        ...item,
        public_url: item.bucket_id === 'place-media' && item.lifecycle_status === 'ready'
          ? client.storage.from('place-media').getPublicUrl(item.storage_path).data.publicUrl : null
      }));
      return mapCanonicalPlaceToShop({...row, place_media: media});
    });
  }, ['public-places-v2', url, publicKey], {
    revalidate: PUBLIC_PLACES_CACHE_SECONDS, tags: [PUBLIC_PLACES_CACHE_TAG]
  })();
}
