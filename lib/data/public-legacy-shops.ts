import {createClient} from '@supabase/supabase-js';
import {unstable_cache} from 'next/cache';
import {LEGACY_SHOP_LIST_COLUMNS} from './legacy-shops';
import {PUBLIC_PLACES_CACHE_SECONDS, PUBLIC_PLACES_CACHE_TAG} from './public-places-cache';

export async function getPublicLegacyShops(url: string, publicKey: string) {
  return unstable_cache(async () => {
    const client = createClient(url, publicKey, {
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
      global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store'})}
    });
    const {data, error} = await client.from('shops').select(LEGACY_SHOP_LIST_COLUMNS).eq('status', 'verified');
    if (error) throw error;
    return data ?? [];
  }, ['public-legacy-shops-v1', url, publicKey], {
    revalidate: PUBLIC_PLACES_CACHE_SECONDS, tags: [PUBLIC_PLACES_CACHE_TAG]
  })();
}
