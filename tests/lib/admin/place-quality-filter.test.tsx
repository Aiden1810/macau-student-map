// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('../../../components/admin/PlaceEditor', () => ({adminEditorRequest: api.request, default: () => null}));
import PlacesManager from '../../../components/admin/PlacesManager';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  api.request.mockResolvedValue({items: [{id: 'p1', name: '缺封面地点', nameEn: null, address: '澳门', status: 'published',
    categorySlug: 'food', region: 'taipa', longitude: 113.5, latitude: 22.1, pricePerPerson: null,
    tagIds: [], searchKeywords: [], media: [], updatedAt: '2026-10-20T01:00:00Z'}]});
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
describe('quality task navigation into the existing place manager', () => {
  it('reopens the same quality task with a clean search instead of an old empty result', async () => {
    const props = {createOpen: false, onCreateClose: () => {}, refreshSignal: 0, qualityFilter: 'cover' as const, onQualityFilterChange: () => {}};
    await act(async () => root.render(<PlacesManager {...props} qualityFocusKey={1} />));
    const input = host.querySelector('input[aria-label="搜索管理地点"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '不存在');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    expect(host.querySelectorAll('article')).toHaveLength(0);
    await act(async () => root.render(<PlacesManager {...props} qualityFocusKey={2} />));
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect((input as HTMLInputElement).value).toBe('');
  });
});
