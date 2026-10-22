import {z} from 'zod';

export const featureSchema = z.enum([
  'assistant.compare',
  'assistant.chat',
  'places.list',
  'shops.list',
]);
export type UsageFeature = z.infer<typeof featureSchema>;
const count = z.number().int().min(0).max(1000000000).nullable();
export const usageEventSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  kind: z.enum(['http', 'ai']),
  feature: featureSchema,
  model: z.string().min(1).max(100).nullable(),
  outcome: z.enum([
    'success',
    'error',
    'timeout',
    'cancelled',
    'limited',
    'rejected',
    'unconfigured',
  ]),
  duration_ms: z.number().int().min(0).max(300000),
  status: z.number().int().min(100).max(599).nullable(),
  input_tokens: count,
  output_tokens: count,
  cache_read_tokens: count,
  cost_low: z.number().finite().nonnegative().nullable(),
  cost_high: z.number().finite().nonnegative().nullable(),
  price_version: z.string().max(64).nullable(),
});
export type UsageEvent = z.infer<typeof usageEventSchema>;
type Tokens = Pick<
  UsageEvent,
  'input_tokens' | 'output_tokens' | 'cache_read_tokens'
>;
const numericCount = (value: unknown): number | null =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 1000000000
    ? value
    : null;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
export function normalizeUsage(value: unknown): Tokens {
  const usage = object(value);
  // DeepSeek's adapter fills absent raw fields with zero. Preserve absence
  // using the raw response, rather than claiming unknown usage is free.
  const hasRaw = usage.raw !== null && typeof usage.raw === 'object';
  const raw = object(usage.raw);
  const input = numericCount(hasRaw ? raw.prompt_tokens : usage.inputTokens);
  const output = numericCount(
    hasRaw ? raw.completion_tokens : usage.outputTokens,
  );
  const cache = numericCount(
    hasRaw
      ? (raw.prompt_cache_hit_tokens ??
          object(raw.prompt_tokens_details).cached_tokens)
      : object(usage.inputTokenDetails).cacheReadTokens,
  );
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens:
      input !== null && cache !== null && cache <= input ? cache : null,
  };
}

/** Official USD reference prices checked 2026-10-22. Bounds avoid assuming a
 * peak-hour/public-holiday tariff. This is not a provider invoice. */
export function estimateCost(
  model: string,
  tokens: Tokens,
): Pick<UsageEvent, 'cost_low' | 'cost_high' | 'price_version'> {
  const rates = [
    'deepseek-flash',
    'deepseek-v4-flash',
    'deepseek-v4-flash-vision-exp',
  ].includes(model)
    ? {hit: 0.003, miss: 0.15, output: 0.6}
    : model === 'deepseek-v4-pro'
      ? {hit: 0.022, miss: 0.66, output: 1.98}
      : null;
  if (!rates || tokens.input_tokens === null || tokens.output_tokens === null)
    return {cost_low: null, cost_high: null, price_version: null};
  const input = tokens.input_tokens,
    output = tokens.output_tokens,
    cache = tokens.cache_read_tokens;
  const low =
    ((cache === null
      ? input * rates.hit
      : cache * rates.hit + (input - cache) * rates.miss) +
      output * rates.output) /
    1000000;
  const high =
    (((cache === null
      ? input * rates.miss
      : cache * rates.hit + (input - cache) * rates.miss) +
      output * rates.output) *
      2) /
    1000000;
  return {cost_low: low, cost_high: high, price_version: 'deepseek-2026-10-22'};
}

export function shouldRecordUsage(
  url: string,
  environment = process.env.VERCEL_ENV,
  nodeEnvironment = process.env.NODE_ENV,
): boolean {
  if (environment !== 'production' || nodeEnvironment !== 'production')
    return false;
  try {
    return [
      'www.aiden-macau-map.top',
      'aiden-macau-map.top',
      'macau-student-map.vercel.app',
    ].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
