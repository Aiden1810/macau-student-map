import type {ApiResult} from './result';

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, options: {code: string; requestId?: string | null; fieldErrors?: Record<string, string[]>}) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.requestId = options.requestId ?? null;
    this.fieldErrors = options.fieldErrors;
  }
}
export async function authenticatedApiRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, {...init, headers});
  const result = (await response.json().catch(() => null)) as ApiResult<T> | null;

  if (!response.ok || !result?.ok) {
    const failure = result && !result.ok ? result : null;
    throw new ApiClientError(failure?.error.message ?? 'Request failed.', {
      code: failure?.error.code ?? 'NETWORK_ERROR',
      requestId: failure?.requestId ?? response.headers.get('x-request-id'),
      fieldErrors: failure?.error.fieldErrors
    });
  }

  return result.data;
}
