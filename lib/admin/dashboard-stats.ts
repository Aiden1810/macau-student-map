import {z} from 'zod';
export const dashboardRangeSchema = z.enum(['24h', '7d', '30d']);
const count = z.number().nonnegative();
const base = {
  range: dashboardRangeSchema,
  rangeStart: z.number(),
  updatedAt: z.number(),
};
const point = {timestamp: z.number(), label: z.string()};
export const registrationStatsSchema = z.object({
  ...base,
  total: count,
  newUsers: count,
  timeline: z.array(z.object({...point, count})),
});
const metric = z.object({
  kind: z.enum(['http', 'ai']),
  calls: count,
  succeeded: count,
  failed: count,
  timeouts: count,
  cancelled: count,
  limited: count,
  rejected: count,
  unconfigured: count,
  meanMs: count,
  p95Ms: count,
  inputTokens: count,
  outputTokens: count,
  unknownUsage: count,
  pricedCalls: count,
  costLow: count.nullable(),
  costHigh: count.nullable(),
});
export const usageReportSchema = z.object({
  ...base,
  collection: z.object({
    enabled: z.boolean(),
    startedAt: z.number().nullable(),
    lastEventAt: z.number().nullable(),
  }),
  retentionDays: count,
  currency: z.literal('USD'),
  summary: z.array(metric),
  breakdown: z.array(
    metric.extend({feature: z.string(), model: z.string().nullable()}),
  ),
  timeline: z.array(z.object({...point, http: count, ai: count})),
});
export type RegistrationStats = z.infer<typeof registrationStatsSchema>;
export type UsageMetric = z.infer<typeof metric>;
export type UsageReport = z.infer<typeof usageReportSchema> & {
  serverConfigured: boolean;
};
