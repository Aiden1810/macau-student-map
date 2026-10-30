// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const db = vi.hoisted(() => ({channel: vi.fn(() => {throw new Error('Homepage must not subscribe');})}));
const toast = vi.hoisted(() => ({success: vi.fn(), error: vi.fn()}));
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({useLocale: () => 'zh-CN', useTranslations: () => translate}));
vi.mock('react-hot-toast', () => ({default: toast}));
vi.mock('../../../lib/supabase', () => ({supabase: {...db, auth: {
  getUser: async () => ({data: {user: null}, error: null}),
  onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}})
}}}));
vi.mock('../../../lib/hooks/useFavorites', () => ({useFavorites: () => ({favorites: [], toggleFavorite() {}, isLoaded: true})}));
vi.mock('../../../i18n/navigation', () => ({Link: ({children}: {children: React.ReactNode}) => <>{children}</>}));
vi.mock('../../../components/ContributionForm', () => ({default: ({onSuccess, onBusyChange}: {
  onSuccess: () => Promise<void>; onBusyChange?: (busy: boolean) => void;
}) => <div>
  <button data-busy onClick={() => onBusyChange?.(true)}>start upload</button>
  <button data-idle onClick={() => onBusyChange?.(false)}>finish upload</button>
  <button data-submit onClick={() => {void onSuccess();}}>submit</button>
</div>}));
vi.mock('../../../components/Header', () => ({default: ({onToggleContribute}: {onToggleContribute: () => void}) =>
  <button data-contribute onClick={onToggleContribute}>contribute</button>}));
vi.mock('../../../components/assistant/FloatingPlaceAssistant', () => ({default: () => null}));
vi.mock('../../../components/MapPlaceholder', () => ({default: () => null}));
vi.mock('../../../components/MobileCategoryNav', () => ({default: () => null}));
vi.mock('../../../components/ShopList', () => ({default: ({filteredShops, loading}: {filteredShops: {name: string}[]; loading: boolean}) =>
  <output data-loading={String(loading)}>{filteredShops.map(shop => shop.name).join(',')}</output>}));

import HomePage from '../../../app/[locale]/page';
let host: HTMLDivElement;
let root: Root;
let failLegacy: boolean;
let failCanonical: boolean;
let canonicalUnavailable: boolean;
let name: string;
let pendingCanonical: Promise<Response> | null;
const legacy = {id: 'old', name: '旧店', category: 'food', status: 'verified', tags: [], image_urls: []};
const shop = {id: 'new', name: '新店', category: 'food', status: 'verified', rating: 0, reviews: 0, tags: [], features: [],
  coordinates: [113.5, 22.1], hasCoordinates: true, imageUrls: [], recommendStatus: 'neutral'};
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0); vi.clearAllMocks();
  failLegacy = false; failCanonical = false; canonicalUnavailable = false; name = '新店'; pendingCanonical = null;
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/shops') return Response.json({ok: !failLegacy, data: {items: [legacy]}}, {status: failLegacy ? 500 : 200});
    if (String(input) === '/api/places') {
      if (pendingCanonical) {const response = pendingCanonical; pendingCanonical = null; return response;}
      return Response.json({ok: !failCanonical, data: {canonicalAvailable: !canonicalUnavailable,
        items: canonicalUnavailable ? [] : [{...shop, name}]}}, {status: failCanonical ? 500 : 200});
    }
    throw new Error(`Unexpected local test request: ${String(input)}`);
  }));
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function returnToPage() {
  await act(async () => {vi.advanceTimersByTime(60000); window.dispatchEvent(new Event('focus'));});
}

describe('homepage automatic updates', () => {
  it('renders only published places and never consults the retired shop endpoint', async () => {
    await act(async () => root.render(<HomePage />));
    expect(host.querySelector('output')?.textContent).toBe('新店');
    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).not.toContain('/api/shops');
  });
  it('reports a failed initial place request even when the retired shop endpoint would succeed', async () => {
    failCanonical = true;
    await act(async () => root.render(<HomePage />));
    expect(host.querySelector('output')?.textContent).toBe('');
    expect(toast.error).toHaveBeenCalled();
    expect(host.querySelector('output')?.dataset.loading).toBe('false');
  });
  it('keeps the contribution mounted when its header toggle is clicked during an operation', async () => {
    await act(async () => root.render(<HomePage />));
    const toggle = () => host.querySelector<HTMLButtonElement>('[data-contribute]')!.click();
    await act(async () => toggle());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-busy]')!.click());
    await act(async () => toggle());
    expect(host.querySelector('[data-submit]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-idle]')!.click());
    await act(async () => toggle());
    expect(host.querySelector('[data-submit]')).toBeNull();
  });
  it('uses HTTP without opening a channel and quietly applies successful updates', async () => {
    await act(async () => root.render(<HomePage />));
    expect(host.querySelector('output')?.textContent).toContain('新店');
    name = '更新后的店';
    await returnToPage();
    expect(host.querySelector('output')?.textContent).toContain('更新后的店');
    expect(host.querySelector('output')?.dataset.loading).toBe('false');
    expect(db.channel).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it.each(['canonical', 'canonical-schema'])('keeps the published list when the automatic %s request fails', async source => {
    await act(async () => root.render(<HomePage />));
    if (source === 'canonical-schema') canonicalUnavailable = true;
    else failCanonical = true;
    name = '不完整的新结果';
    await returnToPage();
    const text = host.querySelector('output')?.textContent;
    expect(text).not.toContain('旧店'); expect(text).toContain('新店'); expect(text).not.toContain('不完整的新结果');
    expect(toast.error).not.toHaveBeenCalled();
  });
  it('lets an in-flight manual refresh finish instead of superseding it with an automatic request', async () => {
    await act(async () => root.render(<HomePage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-contribute]')!.click());
    let resolve!: (response: Response) => void;
    pendingCanonical = new Promise(complete => {resolve = complete;});
    await act(async () => host.querySelector<HTMLButtonElement>('[data-submit]')!.click());
    const before = vi.mocked(fetch).mock.calls.length;
    failCanonical = true;
    await returnToPage();
    expect(vi.mocked(fetch).mock.calls.length).toBe(before);
    await act(async () => resolve(Response.json({ok: true, data: {items: [{...shop, name: '手动更新成功'}]}})));
    expect(host.querySelector('output')?.textContent).toContain('手动更新成功');
  });
});
