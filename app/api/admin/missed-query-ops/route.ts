import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {isAdminRole, readBearerToken} from '@/lib/admin/request-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export async function GET(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const supabase = getSupabase(accessToken);
    const {
      data: {user},
      error: userError
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const {data: profile, error: profileError} = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !isAdminRole(profile?.role)) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403});
    }

    const {searchParams} = new URL(request.url);
    const window = searchParams.get('window') ?? '7d';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20') || 20, 1), 100);

    const windowHours = window === '24h' ? 24 : window === '30d' ? 24 * 30 : 24 * 7;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const [missRes, levelRes, sourceRes] = await Promise.all([
      supabase
        .from('search_events')
        .select('normalized_query, query, matched_level, result_count, created_at')
        .eq('result_count', 0)
        .gte('created_at', since)
        .order('created_at', {ascending: false})
        .limit(2000),
      supabase
        .from('search_events')
        .select('matched_level, result_count')
        .gte('created_at', since),
      supabase
        .from('search_events')
        .select('query, normalized_query, matched_level, result_count, created_at')
        .gte('created_at', since)
        .order('created_at', {ascending: false})
        .limit(2000)
    ]);

    if (missRes.error) throw missRes.error;
    if (levelRes.error) throw levelRes.error;
    if (sourceRes.error) throw sourceRes.error;

    const bucket = new Map<string, {query: string; normalized_query: string; miss_count: number; latest_at: string; matched_levels: Record<string, number>}>();
    for (const row of (missRes.data ?? []) as Array<{query: string; normalized_query: string; matched_level: string; created_at: string}>) {
      const key = row.normalized_query || row.query;
      const entry = bucket.get(key) ?? {query: row.query, normalized_query: row.normalized_query, miss_count: 0, latest_at: row.created_at, matched_levels: {}};
      entry.miss_count += 1;
      entry.latest_at = entry.latest_at > row.created_at ? entry.latest_at : row.created_at;
      entry.matched_levels[row.matched_level] = (entry.matched_levels[row.matched_level] ?? 0) + 1;
      bucket.set(key, entry);
    }

    const totals = (levelRes.data ?? []) as Array<{matched_level: string; result_count: number}>;
    const hitCount = totals.filter((item) => item.result_count > 0).length;
    const totalCount = totals.length;

    return NextResponse.json({
      window,
      since,
      summary: {
        total_count: totalCount,
        hit_count: hitCount,
        miss_count: totalCount - hitCount,
        hit_rate: totalCount > 0 ? hitCount / totalCount : 0
      },
      top_missed_queries: Array.from(bucket.values())
        .sort((a, b) => b.miss_count - a.miss_count || b.latest_at.localeCompare(a.latest_at))
        .slice(0, limit),
      latest_events: (sourceRes.data ?? []).slice(0, 50),
      sql_templates: {
        weekly_top_miss: "select normalized_query, count(*) as miss_count from public.search_events where result_count = 0 and created_at >= now() - interval '7 days' group by normalized_query order by miss_count desc limit 100;",
        weekly_level_breakdown: "select matched_level, count(*) as q from public.search_events where created_at >= now() - interval '7 days' group by matched_level order by q desc;"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({error: message}, {status: 500});
  }
}
