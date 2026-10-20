import type {SupabaseClient} from '@supabase/supabase-js';
import {authenticatedApiRequest} from '../api/client';

export const LEGACY_SHOP_LIST_COLUMNS =
  'id,name,name_i18n,category,student_discount,tags,tags_i18n,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text,review_text_i18n,image_urls,address,main_category,sub_tags,price_per_person,region,signature_dish,sharp_review';

type LegacyListResult = {data: unknown[] | null; error: {message: string} | null};

/** Administrators retain their RLS-protected direct read; visitors share anonymous public data. */
export async function loadLegacyShopList(client: SupabaseClient, isAdmin: boolean): Promise<LegacyListResult> {
  try {
    if (isAdmin) {
      return await client.from('shops').select(LEGACY_SHOP_LIST_COLUMNS)
        .or('status.in.(pending,verified,rejected),status.is.null');
    }
    const response = await fetch('/api/shops', {cache: 'no-store'});
    const result = await response.json();
    if (!response.ok || !result?.ok || !Array.isArray(result.data?.items)) {
      return {data: null, error: {message: 'Unable to load public shops.'}};
    }
    return {data: result.data.items, error: null};
  } catch {
    return {data: null, error: {message: 'Unable to load shops.'}};
  }
}

/** A failed cache notification must not turn an already saved database write into a reported failure. */
export async function notifyShopListChanged(client: SupabaseClient): Promise<void> {
  try {
    const {data} = await client.auth.getSession();
    if (!data.session?.access_token) return;
    await authenticatedApiRequest('/api/admin/shops/refresh-cache', data.session.access_token, {method: 'POST'});
  } catch {
    console.warn('Shop list cache refresh could not be confirmed; timed revalidation will retry.');
  }
}
