import {createAdminRoute} from './api';
import {dashboardRangeSchema, usageReportSchema} from './dashboard-stats';
import {errorResponse, successResponse} from '../api/result';
export function createUsageRoute(
  dependencies?: Parameters<typeof createAdminRoute>[1],
) {
  return createAdminRoute<Record<string, never>>(async (request, client) => {
    const range = dashboardRangeSchema.safeParse(
      new URL(request.url).searchParams.get('range') ?? '7d',
    );
    if (!range.success)
      return errorResponse({
        code: 'VALIDATION_ERROR',
        status: 422,
        message: '请选择 24 小时、7 天或 30 天。',
      });
    const {data, error} = await client.rpc('admin_usage_report', {
      p_range: range.data,
    });
    if (error) throw error;
    return successResponse({
      ...usageReportSchema.parse(data),
      serverConfigured: process.env.API_USAGE_INGEST_TOKEN?.length === 64,
    });
  }, dependencies);
}
