import {afterEach, describe, expect, it, vi} from 'vitest';
import {interpretPlaceQuestion} from '../../../lib/assistant/model';
const intent = {
  intent: 'recommend',
  budgetPerPerson: 40,
  totalBudget: null,
  currency: 'CNY',
  partySize: 4,
  foods: ['粉面'],
  excludedFoods: [],
  priority: 'balanced',
  transport: 'either',
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('DeepSeek provider integration', () => {
  it('uses the verified model id and structured JSON without sharing exact origin', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key-not-a-real-secret');
    const mock = vi.fn(async () =>
      Response.json({
        id: 'test',
        object: 'chat.completion',
        created: 1,
        model: 'deepseek-flash',
        choices: [
          {
            index: 0,
            message: {role: 'assistant', content: JSON.stringify(intent)},
            finish_reason: 'stop',
          },
        ],
        usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
      }),
    );
    vi.stubGlobal('fetch', mock);
    expect(
      await interpretPlaceQuestion(
        ['四个人吃面，人均40'],
        [],
        AbortSignal.timeout(3000),
      ),
    ).toEqual(intent);
    const [url, options] = mock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe('deepseek-flash');
    expect(body.thinking).toEqual({type: 'disabled'});
    expect(body.response_format.type).toBe('json_object');
    expect(JSON.stringify(body)).not.toContain('test-key-not-a-real-secret');
  });
});
