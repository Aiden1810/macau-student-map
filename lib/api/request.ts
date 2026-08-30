import {z} from 'zod';
import type {ApiErrorDescriptor} from './result';

export type ParsedJsonBody<T> =
  | {ok: true; data: T}
  | {ok: false; error: ApiErrorDescriptor};

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options?: {maxBytes?: number}
): Promise<ParsedJsonBody<T>> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json.',
        status: 415
      }
    };
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      error: {code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.', status: 413}
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return {
      ok: false,
      error: {code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.', status: 413}
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      error: {code: 'INVALID_JSON', message: 'Request body contains invalid JSON.', status: 400}
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        status: 422,
        fieldErrors: flattened.fieldErrors as Record<string, string[]>
      }
    };
  }

  return {ok: true, data: parsed.data};
}
