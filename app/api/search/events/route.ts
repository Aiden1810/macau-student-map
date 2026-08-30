import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {isMissingRelationError} from '@/lib/supabase/errors';

const searchEventSchema = z.object({
  query: z.string().max(200),
  normalized_query: z.string().max(200),
  filters: z.record(z.string(), z.unknown()).default({}),
  result_count: z.number().int().nonnegative(),
  matched_level: z.enum(['none', 'name', 'tag', 'alias', 'full_text', 'filter_only'])
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  const body = await parseJsonBody(request, searchEventSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Analytics is deliberately non-blocking for local/offline development.
    return successResponse({recorded: false, reason: 'not_configured'}, {status: 202, requestId});
  }

  const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  const {error} = await client.from('search_events').insert({...body.data, user_id: null});

  if (error) {
    if (isMissingRelationError(error)) {
      return successResponse({recorded: false, reason: 'migration_pending'}, {status: 202, requestId});
    }
    console.error(`[${requestId}] search event insert failed:`, error.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to record search analytics.', status: 500},
      requestId
    );
  }

  return successResponse({recorded: true}, {status: 202, requestId});
}
