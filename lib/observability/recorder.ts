import {usageEventSchema, type UsageEvent} from './events';
type Config = {url: string; key: string; token: string};

export async function recordUsageBatch(
  events: UsageEvent[],
  send: typeof fetch = fetch,
  config: Config = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    token: process.env.API_USAGE_INGEST_TOKEN ?? '',
  },
): Promise<boolean> {
  if (
    !events.length ||
    !config.url ||
    !config.key ||
    config.token.length !== 64
  )
    return false;
  try {
    // Parsing strips accidental extra fields before they leave this server.
    const batch = usageEventSchema.array().min(1).max(20).parse(events);
    const response = await send(
      `${config.url.replace(/\/$/, '')}/rest/v1/rpc/record_api_usage`,
      {
        method: 'POST',
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({p_token: config.token, p_events: batch}),
        signal: AbortSignal.timeout(2000),
        cache: 'no-store',
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
