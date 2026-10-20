import {createAdminRoute} from './api';
import {readOperations} from './operations-repository';
import {errorResponse, successResponse} from '../api/result';

export function createOperationsRoute(dependencies?: Parameters<typeof createAdminRoute>[1]) {
  return createAdminRoute<Record<string, never>>(async (request, client) => {
    const range = new URL(request.url).searchParams.get('range') ?? '7d';
    if (range !== '24h' && range !== '7d' && range !== '30d') {
      return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '请选择 24 小时、7 天或 30 天。'});
    }
    return successResponse(await readOperations(client, range, Date.now(), request.signal));
  }, dependencies);
}
