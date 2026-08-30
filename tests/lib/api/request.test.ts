import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {parseJsonBody} from '../../../lib/api/request';

const payloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(['draft', 'pending']).default('draft'),
  longitude: z.number().finite().min(-180).max(180).nullable().default(null)
});

describe('parseJsonBody', () => {
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
