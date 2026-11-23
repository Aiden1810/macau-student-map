import {createClient} from '@supabase/supabase-js';
import {MEDIA_BUCKET} from './business';

import {DiscoveryError} from '@/lib/amap/discovery-provider';
import type {DiscoveryQuery, DiscoveryResult} from './search';

export async function discoveryPost<T>(path: string, body: unknown, options?: {signal?: AbortSignal; token?: string}): Promise<T> {
  const timeout = AbortSignal.timeout(19000);
  const signal = options?.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const response = await fetch('/api/discovery/' + path, {
    method: 'POST', cache: 'no-store', signal,
    headers: {'Content-Type': 'application/json', ...(options?.token ? {Authorization: 'Bearer ' + options.token} : {})},
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new DiscoveryError(data?.error ?? 'REQUEST_FAILED', response.status);
  return data as T;
}

export const discover = (query: DiscoveryQuery, signal?: AbortSignal) =>
  discoveryPost<DiscoveryResult>('search', query, {signal});

export async function uploadRecommendationImage(id: string, file: File, token: string, caller: AbortSignal) {
  const signal = AbortSignal.any([caller, AbortSignal.timeout(12000)]);
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => token,
    global: {fetch: (input, init) => fetch(input, {...init, signal})}
  }).storage;
  const {error} = await storage.from(MEDIA_BUCKET).upload(id, file, {
    upsert: false, cacheControl: '30', contentType: file.type
  });
  if (error) throw new DiscoveryError('PHOTO_FAILED', 400);
}
