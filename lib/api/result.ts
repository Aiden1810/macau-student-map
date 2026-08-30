export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type ApiErrorDescriptor = {
  code: ApiErrorCode;
  message: string;
  status: number;
  fieldErrors?: Record<string, string[]>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: Omit<ApiErrorDescriptor, 'status'>;
  requestId: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export function successResponse<T>(data: T, options?: {status?: number; requestId?: string}): Response {
  const requestId = options?.requestId ?? createRequestId();
  return Response.json(
    {ok: true, data, requestId} satisfies ApiSuccess<T>,
    {status: options?.status ?? 200, headers: {'x-request-id': requestId}}
  );
}

export function errorResponse(error: ApiErrorDescriptor, requestId = createRequestId()): Response {
  const {status, ...publicError} = error;
  return Response.json(
    {ok: false, error: publicError, requestId} satisfies ApiFailure,
    {status, headers: {'x-request-id': requestId}}
  );
}
