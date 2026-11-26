import {createClient} from '@supabase/supabase-js';
import {successResponse, errorResponse} from '@/lib/api/result';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return errorResponse({code: 'INTERNAL_ERROR', status: 500, message: 'Public database unavailable.'});
  const db = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  const {data, error} = await db.rpc('public_student_recommended_places');
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return successResponse({available: false, items: []});
  }
  if (error) return errorResponse({code: 'INTERNAL_ERROR', status: 503, message: 'Student recommendations unavailable.'});
  return successResponse({available: true, items: data ?? []});
}
