import {createClient} from '@supabase/supabase-js';
import {readBearerToken} from '@/lib/admin/request-auth';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {MEDIA_BUCKET, mediaTypes} from '@/lib/discovery/business';
import {serviceClient} from '@/lib/discovery/business-server';
import {placeIdSchema} from '@/lib/discovery/search';
import {crossSiteRequest, discoveryFailure, discoveryResponse} from '@/lib/discovery/server';

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (crossSiteRequest(request)) return discoveryResponse({error: 'FORBIDDEN'}, 403);
  const parsed = placeIdSchema.safeParse((await params).id);
  if (!parsed.success) return discoveryResponse({error: 'NOT_FOUND'}, 404);
  try {
    const token = readBearerToken(request);
    const client = token ? createAuthenticatedSupabaseClient(token) : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {auth: {persistSession: false, autoRefreshToken: false}}
    );
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
    const {data: path, error} = await client.rpc('student_recommendation_image', {p_id: parsed.data}).abortSignal(signal);
    if (error) {
      if (token && (error.code === 'PGRST301' || error.code === 'PGRST303')) return discoveryResponse({error: 'SIGN_IN'}, 401);
      throw error;
    }
    if (path !== parsed.data) return discoveryResponse({error: 'NOT_FOUND'}, 404);
    const {data, error: storageError} = await serviceClient().storage.from(MEDIA_BUCKET).download(path, {}, {signal});
    if (storageError || !data) return discoveryResponse({error: 'NOT_FOUND'}, 404);
    if (data.size > 1048576 || !mediaTypes.includes(data.type)) return discoveryResponse({error: 'NOT_FOUND'}, 404);
    // Enforce the recommendation's current visibility on each request.
    return new Response(data, {headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': data.type,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff'
    }});
  } catch (error) {return discoveryFailure(error);}
}
