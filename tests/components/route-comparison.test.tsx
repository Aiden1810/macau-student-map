import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import RouteComparisonTable from '../../components/assistant/RouteComparisonTable';
import {assistantCopy} from '../../lib/assistant/copy';
import type {AssistantPlace, RouteSnapshot} from '../../lib/assistant/contracts';

const copy = assistantCopy('zh-CN');
const places: AssistantPlace[] = ['a', 'b', 'c'].map(id => ({id, name: `Place ${id}`, address: '',
  category: 'food', pricePerPerson: null, tags: [], coordinates: [113.55, 22.16]}));
const origin = {label: 'Origin', coordinates: [113.54, 22.15] as [number, number], city: '澳门' as const};
const ok = (seconds: number) => ({status: 'ok' as const, durationSeconds: seconds, distanceMeters: 1000,
  lines: ['Bus 26', 'Bus 33'], walkingMeters: 150});
const routes: RouteSnapshot[] = [61, 62, 61].map((seconds, i) => ({placeId: places[i].id, origin: origin.coordinates,
  destination: places[i].coordinates!, queriedAt: 1, source: 'amap-js', taxi: ok(seconds),
  transit: {status: 'no_route'}, walking: ok(i === 1 ? 120 : 240)}));

describe('route hierarchy', () => {
  it('compares seconds before rounding minutes and highlights all ties in each mode', () => {
    const html = renderToStaticMarkup(<RouteComparisonTable places={places} routes={routes} origin={origin} copy={copy} />);
    const articles = html.split('<article').slice(1);
    expect(articles.map(p => (p.match(/aria-label="[^"]*：最快"/g) ?? []).length)).toEqual([1, 1, 1]);
    expect(articles[1]).not.toContain('打车行程：最快');
    expect(articles[1]).toContain('步行：最快');
  });
  it('keeps route details collapsed and navigation outside the disclosure', () => {
    const html = renderToStaticMarkup(<RouteComparisonTable places={places.slice(0, 1)} routes={routes} origin={origin} copy={copy} />);
    expect(html).toContain('<details');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('Bus 26');
    expect(html).toMatch(/<\/details>[\s\S]*查看路线/);
  });
  it('shows unavailable routes without inventing zero minutes', () => {
    const html = renderToStaticMarkup(<RouteComparisonTable places={places} routes={[]} origin={origin} copy={copy} />);
    expect(html).toContain('暂无可用路线');
    expect(html).not.toMatch(/>0(?:<!-- -->)?\s*(?:<!-- -->)?<span/);
    expect(html).not.toContain('最快');
  });
});
