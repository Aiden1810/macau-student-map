import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(request: Request) {
  try {
    const {searchParams} = new URL(request.url);
    const window = searchParams.get('window') ?? '7d';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20') || 20, 1), 100);

    const windowHours = window === '24h' ? 24 : window === '30d' ? 24 * 30 : 24 * 7;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const supabase = getSupabase();

    const [missRes, levelRes, sourceRes] = await Promise.all([
      supabase
        .from('search_query_log')
        .select('normalized_query, query, hit, matched_level, result_count, searched_at')
        .eq('hit', false)
        .gte('searched_at', since)
        .order('searched_at', {ascending: false})
        .limit(2000),
      supabase
        .from('search_query_log')
        .select('matched_level, hit')
        .gte('searched_at', since),
      supabase
        .from('search_query_log')
        .select('query, normalized_query, hit, matched_level, result_count, searched_at')
        .gte('searched_at', since)
        .order('searched_at', {ascending: false})
        .limit(2000)
    ]);

    if (missRes.error) throw missRes.error;
    if (levelRes.error) throw levelRes.error;
    if (sourceRes.error) throw sourceRes.error;

    const bucket = new Map<string, {query: string; normalized_query: string; miss_count: number; latest_at: string; matched_levels: Record<string, number>}>();
    for (const row of (missRes.data ?? []) as Array<{query: string; normalized_query: string; matched_level: string; searched_at: string}>) {
      const key = row.normalized_query || row.query;
      const entry = bucket.get(key) ?? {query: row.query, normalized_query: row.normalized_query, miss_count: 0, latest_at: row.searched_at, matched_levels: {}};
      entry.miss_count += 1;
      entry.latest_at = entry.latest_at > row.searched_at ? entry.latest_at : row.searched_at;
      entry.matched_levels[row.matched_level] = (entry.matched_levels[row.matched_level] ?? 0) + 1;
      bucket.set(key, entry);
    }

    const totals = (levelRes.data ?? []) as Array<{matched_level: string; hit: boolean}>;
    const hitCount = totals.filter((item) => item.hit).length;
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
        weekly_top_miss: "select normalized_query, count(*) as miss_count from public.search_query_log where hit = false and searched_at >= now() - interval '7 days' group by normalized_query order by miss_count desc limit 100;",
        weekly_level_breakdown: "select matched_level, count(*) as q from public.search_query_log where searched_at >= now() - interval '7 days' group by matched_level order by q desc;"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({error: message}, {status: 500});
  }
}
