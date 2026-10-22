import {describe, expect, it, vi} from 'vitest';
import {
  instrumentApi,
  measureModelCall,
} from '../../../lib/observability/context';
import {
  estimateCost,
  normalizeUsage,
  shouldRecordUsage,
  type UsageEvent,
} from '../../../lib/observability/events';
import {recordUsageBatch} from '../../../lib/observability/recorder';
import {createDeepSeek} from '@ai-sdk/deepseek';
import {generateText} from 'ai';

describe('server usage and cost metadata', () => {
  it('keeps unknown usage null and computes conservative official peak/off-peak bounds', () => {
    expect(normalizeUsage(undefined)).toEqual({
      input_tokens: null,
      output_tokens: null,
      cache_read_tokens: null,
    });
    expect(
      normalizeUsage({
        inputTokens: 0,
        outputTokens: 0,
        inputTokenDetails: {cacheReadTokens: 0},
      }),
    ).toEqual({input_tokens: 0, output_tokens: 0, cache_read_tokens: 0});
    expect(
      estimateCost('deepseek-flash', {
        input_tokens: 1000000,
        output_tokens: 1000000,
        cache_read_tokens: 0,
      }),
    ).toEqual({
      cost_low: 0.75,
      cost_high: 1.5,
      price_version: 'deepseek-2026-10-22',
    });
    expect(
      estimateCost('unknown', {
        input_tokens: 1,
        output_tokens: 1,
        cache_read_tokens: 0,
      }).cost_low,
    ).toBeNull();
    expect(
      estimateCost('deepseek-flash', {
        input_tokens: 1,
        output_tokens: null,
        cache_read_tokens: 0,
      }).cost_high,
    ).toBeNull();
    expect(
      estimateCost('deepseek-flash', {
        input_tokens: 1000000,
        output_tokens: 0,
        cache_read_tokens: null,
      }),
    ).toMatchObject({cost_low: 0.003, cost_high: 0.3});
  });
  it('only records production requests on the actual public domains', () => {
    expect(
      shouldRecordUsage(
        'https://www.aiden-macau-map.top/api/places',
        'production',
        'production',
      ),
    ).toBe(true);
    for (const url of [
      'http://localhost:3000',
      'https://preview.vercel.app',
      'https://evil.example',
    ])
      expect(shouldRecordUsage(url, 'production', 'production')).toBe(false);
    expect(
      shouldRecordUsage(
        'https://www.aiden-macau-map.top',
        'preview',
        'production',
      ),
    ).toBe(false);
  });
  it('does not trust SDK zeros synthesized for fields missing from the raw DeepSeek response', () => {
    expect(
      normalizeUsage({
        inputTokens: 120,
        outputTokens: 0,
        inputTokenDetails: {cacheReadTokens: 0},
        raw: {prompt_tokens: 120},
      }),
    ).toEqual({
      input_tokens: 120,
      output_tokens: null,
      cache_read_tokens: null,
    });
    expect(
      normalizeUsage({
        inputTokens: 0,
        outputTokens: 0,
        inputTokenDetails: {cacheReadTokens: 0},
        raw: {},
      }),
    ).toEqual({
      input_tokens: null,
      output_tokens: null,
      cache_read_tokens: null,
    });
  });
  it('preserves missing fields through the actual DeepSeek provider and AI SDK boundary', async () => {
    const provider = createDeepSeek({
      apiKey: 'fixture-key',
      fetch: async () =>
        Response.json({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: 'deepseek-flash',
          choices: [
            {
              index: 0,
              message: {role: 'assistant', content: 'fixture response'},
              finish_reason: 'stop',
            },
          ],
          usage: {prompt_tokens: 100},
        }),
    });
    const result = await generateText({
      model: provider('deepseek-flash'),
      prompt: 'synthetic input',
      maxRetries: 0,
    });
    expect(normalizeUsage(result.usage)).toEqual({
      input_tokens: 100,
      output_tokens: null,
      cache_read_tokens: null,
    });
  });
  it('captures AI tokens before output parsing fails without saving the error message or prompt', async () => {
    const batches: UsageEvent[][] = [];
    const pending: Array<() => Promise<void>> = [];
    const route = instrumentApi(
      'assistant.chat',
      async () => {
        try {
          await measureModelCall(
            'assistant.chat',
            'deepseek-flash',
            new AbortController().signal,
            async (capture) => {
              capture({
                inputTokens: 100,
                outputTokens: 20,
                inputTokenDetails: {cacheReadTokens: 0},
              });
              throw new Error('private prompt and credential');
            },
          );
        } catch {
          return new Response('{}', {status: 503});
        }
        return new Response('{}');
      },
      {
        enabled: () => true,
        schedule: (work) => pending.push(work),
        writer: async (events) => {
          batches.push(events);
          return true;
        },
      },
    );
    const response = await route(
      new Request('https://www.aiden-macau-map.top/api/assistant/chat'),
    );
    expect(response.status).toBe(503);
    expect(batches).toHaveLength(0);
    await pending[0]();
    expect(batches[0]).toHaveLength(2);
    expect(batches[0].find((e) => e.kind === 'ai')).toMatchObject({
      outcome: 'error',
      input_tokens: 100,
      output_tokens: 20,
    });
    expect(JSON.stringify(batches)).not.toContain('private');
  });
  it('isolates concurrent requests, counts timeout with unknown usage and ignores writer errors', async () => {
    const batches: UsageEvent[][] = [];
    const scheduled: Array<() => Promise<void>> = [];
    const route = instrumentApi(
      'assistant.compare',
      async () => {
        try {
          await measureModelCall(
            'assistant.compare',
            'deepseek-flash',
            AbortSignal.abort(new DOMException('timeout', 'TimeoutError')),
            async () => {
              throw new Error('failed');
            },
          );
        } catch {}
        return new Response('{}', {status: 503});
      },
      {
        enabled: () => true,
        schedule: (work) => scheduled.push(work),
        writer: async (events) => {
          batches.push(events);
          throw new Error('private writer error');
        },
      },
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = await Promise.all([
      route(new Request('https://www.aiden-macau-map.top/api/assistant')),
      route(new Request('https://www.aiden-macau-map.top/api/assistant')),
    ]);
    expect(results.every((r) => r.status === 503)).toBe(true);
    await Promise.all(scheduled.map((work) => work()));
    expect(batches).toHaveLength(2);
    expect(batches[0][0].request_id).not.toBe(batches[1][0].request_id);
    expect(batches[0].find((e) => e.kind === 'ai')).toMatchObject({
      outcome: 'timeout',
      input_tokens: null,
      cost_low: null,
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain(
      'private writer error',
    );
    warn.mockRestore();
  });
  it('returns the original response without scheduling when collection is disabled', async () => {
    const schedule = vi.fn();
    const response = new Response('unchanged');
    const route = instrumentApi('places.list', async () => response, {
      enabled: () => false,
      schedule,
    });
    expect(await route(new Request('http://localhost'))).toBe(response);
    expect(schedule).not.toHaveBeenCalled();
  });
  it('writes only allowlisted metadata and fails quietly on network errors or missing configuration', async () => {
    const send = vi.fn().mockResolvedValue(new Response('2'));
    expect(
      await recordUsageBatch([], send, {url: '', key: '', token: ''}),
    ).toBe(false);
    const event = {
      id: '11111111-1111-4111-8111-111111111111',
      request_id: '22222222-2222-4222-8222-222222222222',
      occurred_at: new Date().toISOString(),
      kind: 'http',
      feature: 'places.list',
      outcome: 'success',
      duration_ms: 1,
      status: 200,
      model: null,
      input_tokens: null,
      output_tokens: null,
      cache_read_tokens: null,
      cost_low: null,
      cost_high: null,
      price_version: null,
      prompt: 'never store',
    };
    expect(
      await recordUsageBatch([event as UsageEvent], send, {
        url: 'https://db.example.test',
        key: 'public-key',
        token: 'a'.repeat(64),
      }),
    ).toBe(true);
    const body = JSON.parse(send.mock.calls[0][1].body);
    expect(body.p_events[0]).not.toHaveProperty('prompt');
    send.mockRejectedValueOnce(new Error('network'));
    expect(
      await recordUsageBatch([event as UsageEvent], send, {
        url: 'https://db.example.test',
        key: 'public',
        token: 'a'.repeat(64),
      }),
    ).toBe(false);
  });
});
