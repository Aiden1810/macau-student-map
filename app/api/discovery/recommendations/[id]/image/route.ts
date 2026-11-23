
import {createClient} from '@supabase/supabase-js';
import {readBearerToken} from '@/lib/admin/request-auth';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {MEDIA_BUCKET} from '@/lib/discovery/business';
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
    const {data: path, error} = await client.rpc('student_recommendation_image', {p_id: parsed.data});
    if (error) throw error;
    if (path !== parsed.data) return discoveryResponse({error: 'NOT_FOUND'}, 404);
    const {data, error: storageError} = await serviceClient().storage.from(MEDIA_BUCKET).createSignedUrl(path, 60);
    if (storageError || !data) return discoveryResponse({error: 'NOT_FOUND'}, 404);
    if (token) return discoveryResponse({url: data.signedUrl});
    return new Response(null, {status: 302, headers: {Location: data.signedUrl, 'Cache-Control': 'private, no-store'}});
  } catch (error) {return discoveryFailure(error);}
}
