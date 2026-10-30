import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {parseJsonBody} from '../../../lib/api/request';

const payloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(['draft', 'pending']).default('draft'),
  longitude: z.number().finite().min(-180).max(180).nullable().default(null)
});

describe('parseJsonBody', () => {
  it.each([null, '1'])('stops reading oversized streams even with content-length=%s', async (declaredLength) => {
    let chunksRead = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunksRead === 100) {controller.close(); return;}
        chunksRead += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(16)));
      },
      cancel() {cancelled = true;}
    }, {highWaterMark: 0});
    const headers = new Headers({'content-type': 'application/json'});
    if (declaredLength) headers.set('content-length', declaredLength);
    const request = new Request('https://example.com/api', {
      method: 'POST', headers, body, duplex: 'half'
    } as RequestInit);

    await expect(parseJsonBody(request, payloadSchema, {maxBytes: 64})).resolves.toMatchObject({
      ok: false, error: {code: 'PAYLOAD_TOO_LARGE', status: 413}
    });
    expect(cancelled).toBe(true);
    expect(chunksRead).toBeLessThan(100);
  });

  it('decodes UTF-8 characters split across stream chunks at the exact byte limit', async () => {
    const bytes = new TextEncoder().encode('{"name":"城"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 10));
        controller.enqueue(bytes.slice(10, 11));
        controller.enqueue(bytes.slice(11));
        controller.close();
      }
    });
    const request = new Request('https://example.com/api', {
      method: 'POST', headers: {'content-type': 'application/json'}, body, duplex: 'half'
    } as RequestInit);
    await expect(parseJsonBody(request, payloadSchema, {maxBytes: 14})).resolves.toEqual({
      ok: true, data: {name: '城', status: 'draft', longitude: null}
    });
  });

  it('counts UTF-8 bytes rather than characters for the body limit', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: '{"name":"城"}'
    });
    await expect(parseJsonBody(request, payloadSchema, {maxBytes: 13})).resolves.toMatchObject({
      ok: false, error: {code: 'PAYLOAD_TOO_LARGE', status: 413}
    });
  });

  it('returns a controlled error if the request stream fails', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {controller.error(new Error('private transport details'));}
    });
    const request = new Request('https://example.com/api', {
      method: 'POST', headers: {'content-type': 'application/json'}, body, duplex: 'half'
    } as RequestInit);
    await expect(parseJsonBody(request, payloadSchema)).resolves.toMatchObject({
      ok: false, error: {code: 'INVALID_JSON', status: 400}
    });
  });

  it('returns typed and normalized data for a valid request', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({name: '  新地點  ', longitude: 113.55})
    });

    await expect(parseJsonBody(request, payloadSchema)).resolves.toEqual({
      ok: true,
      data: {name: '新地點', status: 'draft', longitude: 113.55}
    });
  });

  it('rejects malformed JSON without leaking parser details', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{not-json'
    });

    await expect(parseJsonBody(request, payloadSchema)).resolves.toMatchObject({
      ok: false,
      error: {code: 'INVALID_JSON', status: 400}
    });
  });

  it('rejects an unsupported content type', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: {'content-type': 'text/plain'},
      body: 'name=test'
    });

    await expect(parseJsonBody(request, payloadSchema)).resolves.toMatchObject({
      ok: false,
      error: {code: 'UNSUPPORTED_MEDIA_TYPE', status: 415}
    });
  });

  it('rejects oversized bodies before parsing them', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({name: 'x'.repeat(200)})
    });

    await expect(parseJsonBody(request, payloadSchema, {maxBytes: 64})).resolves.toMatchObject({
      ok: false,
      error: {code: 'PAYLOAD_TOO_LARGE', status: 413}
    });
  });

  it('returns field errors for invalid status and coordinates', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({name: '', status: 'approved', longitude: 999})
    });

    const result = await parseJsonBody(request, payloadSchema);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        status: 422,
        fieldErrors: {
          name: expect.any(Array),
          status: expect.any(Array),
          longitude: expect.any(Array)
        }
      }
    });
  });
});
