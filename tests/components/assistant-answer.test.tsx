import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import AssistantAnswer from '../../components/assistant/AssistantAnswer';
import {assistantCopy} from '../../lib/assistant/copy';
import {comparePlaces} from '../../lib/assistant/decision';
import type {AssistantIntent, AssistantPlace} from '../../lib/assistant/contracts';

const copy = assistantCopy('zh-CN');
const places: AssistantPlace[] = [28, null].map((price, i) => ({id: `${i}`, name: `Candidate ${i}`,
  address: '', category: 'food', pricePerPerson: price, coordinates: null, tags: []}));
const intent: AssistantIntent = {intent: 'recommend', budgetPerPerson: null, totalBudget: null, currency: 'CNY',
  partySize: 4, foods: [], excludedFoods: [], priority: 'cheapest', transport: 'either'};
const decision = comparePlaces(places, intent, []);
const message = {id: 'm', role: 'assistant' as const, text: 'Existing explanation with untrusted numbers: 999 min', intent, decision};

describe('structured recommendation answer', () => {
  it('uses the code decision for winner and prices, leaving the explanation below the card', () => {
    const html = renderToStaticMarkup(<AssistantAnswer message={message} copy={copy} />);
    expect(html).toContain('aria-label="更推荐"');
    expect(html).toContain('Candidate 0');
    expect(html).toContain('Candidate 1');
    expect(html).toContain('CNY 28');
    expect(html).toContain('暂无');
    expect(html.indexOf('CNY 28')).toBeLessThan(html.indexOf(message.text));
    expect(html).not.toContain('0 分钟');
  });
  it.each([undefined, {...decision, reason: 'no_match' as const}, {...decision, recommendedPlaceId: 'absent'}])(
    'falls back to the existing answer if a reliable structured recommendation is unavailable', data => {
      const html = renderToStaticMarkup(<AssistantAnswer message={{...message, decision: data}} copy={copy} />);
      expect(html).toContain(message.text);
      expect(html).not.toContain('aria-label="更推荐"');
    });
  it('keeps historical text as text and does not revive stale comparison results', () => {
    const html = renderToStaticMarkup(<AssistantAnswer message={{...message, historical: true}} copy={copy} />);
    expect(html).not.toContain('aria-label="更推荐"');
    expect(html).toContain(message.text);
  });
});
