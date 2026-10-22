import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {after} from 'next/server';
import {
  estimateCost,
  normalizeUsage,
  shouldRecordUsage,
  type UsageEvent,
  type UsageFeature,
} from './events';
import {recordUsageBatch} from './recorder';

type Context = {requestId: string; events: UsageEvent[]; now: () => number};
const contexts = new AsyncLocalStorage<Context>();
type Dependencies = {
  enabled?: (request: Request) => boolean;
  schedule?: (work: () => Promise<void>) => void;
  writer?: (events: UsageEvent[]) => Promise<boolean>;
  now?: () => number;
};
const elapsed = (now: number, start: number) =>
  Math.max(0, Math.min(300000, Math.round(now - start)));
function failure(error: unknown, signal: AbortSignal): UsageEvent['outcome'] {
  const record =
    error && typeof error === 'object'
      ? (error as {name?: string; statusCode?: number})
      : {};
  const reason = signal.reason as {name?: string} | undefined;
  if (
    record.name === 'TimeoutError' ||
    (signal.aborted && reason?.name === 'TimeoutError')
  )
    return 'timeout';
  if (signal.aborted || record.name === 'AbortError') return 'cancelled';
  return record.statusCode === 429 ? 'limited' : 'error';
}
export async function measureModelCall<T>(
  feature: UsageFeature,
  model: string,
  signal: AbortSignal,
  operation: (capture: (usage: unknown) => void) => Promise<T>,
): Promise<T> {
  const context = contexts.getStore();
  if (!context) return operation(() => {});
  const start = context.now();
  let usage = normalizeUsage(null);
  let outcome: UsageEvent['outcome'] = 'success';
  const capture = (value: unknown) => {
    usage = normalizeUsage(value);
  };
  try {
    return await operation(capture);
  } catch (error) {
    outcome = failure(error, signal);
    if (error && typeof error === 'object' && 'usage' in error && error.usage)
      capture(error.usage);
    throw error;
  } finally {
    context.events.push({
      id: randomUUID(),
      request_id: context.requestId,
      occurred_at: new Date(start).toISOString(),
      kind: 'ai',
      feature,
      model,
      outcome,
      duration_ms: elapsed(context.now(), start),
      status: null,
      ...usage,
      ...estimateCost(model, usage),
    });
  }
}

/** Request-local state prevents parallel calls from sharing tokens or timings. */
export function instrumentApi(
  feature: UsageFeature,
  handler: (request: Request) => Promise<Response>,
  dependencies: Dependencies = {},
) {
  return async (request: Request): Promise<Response> => {
    if (
      !(
        dependencies.enabled ??
        ((req) =>
          Boolean(process.env.API_USAGE_INGEST_TOKEN) &&
          shouldRecordUsage(req.url))
      )(request)
    )
      return handler(request);
    const now = dependencies.now ?? Date.now,
      start = now();
    const context: Context = {requestId: randomUUID(), events: [], now};
    return contexts.run(context, async () => {
      let status = 500;
      let outcome: UsageEvent['outcome'] = 'error';
      try {
        const response = await handler(request);
        status = response.status;
        outcome =
          status === 429
            ? 'limited'
            : status >= 500
              ? 'error'
              : status >= 400
                ? 'rejected'
                : 'success';
        if (response.ok && feature.startsWith('assistant.')) {
          try {
            const body = await response.clone().json();
            if (body.data?.mode === 'unconfigured') outcome = 'unconfigured';
          } catch {}
        }
        return response;
      } catch (error) {
        outcome = failure(error, request.signal);
        throw error;
      } finally {
        context.events.push({
          id: randomUUID(),
          request_id: context.requestId,
          occurred_at: new Date(start).toISOString(),
          kind: 'http',
          feature,
          model: null,
          status,
          outcome,
          duration_ms: elapsed(now(), start),
          ...normalizeUsage(null),
          cost_low: null,
          cost_high: null,
          price_version: null,
        });
        try {
          (dependencies.schedule ?? after)(async () => {
            try {
              if (
                !(await (dependencies.writer ?? recordUsageBatch)(
                  context.events,
                ))
              )
                console.warn('Usage metadata was not saved.');
            } catch {
              console.warn('Usage metadata was not saved.');
            }
          });
        } catch {
          console.warn('Usage metadata could not be scheduled.');
        }
      }
    });
  };
}
