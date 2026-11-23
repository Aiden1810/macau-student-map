// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {hasMoreCatalogRows} from '@/lib/discovery/catalog';
import type {DiscoveryResult} from '@/lib/discovery/search';

const mocks = vi.hoisted(() => ({discover: vi.fn(), rpc: vi.fn()}));
vi.mock('@/lib/discovery/client', () => ({discover: mocks.discover}));
vi.mock('@/lib/supabase', () => ({supabase: {rpc: mocks.rpc}}));
import {useDiscoverySearch} from '@/lib/hooks/useDiscoverySearch';

const entries = (offset: number, count: number) => Array.from({length: count}, (_, index) => ({
  id: 'fixture-' + (index + offset), name: 'test', address: '', longitude: 113.54, latitude: 22.18, recommended: false
}));
const search = {kind: 'text', city: '澳门', page: 1} as const;
const noAmapResults: DiscoveryResult = {items: [], hasMore: false};

async function withHook(run: (getHook: () => ReturnType<typeof useDiscoverySearch>) => Promise<void>) {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  const root = createRoot(document.createElement('div'));
  let hook: ReturnType<typeof useDiscoverySearch>;
  function Probe() {hook = useDiscoverySearch(); return null;}
  await act(async () => root.render(<Probe />));
  try {await run(() => hook);}
  finally {await act(async () => root.unmount()); vi.resetAllMocks();}
}

it('replays a partial page with both original cursors before advancing', async () => {
  await withHook(async getHook => {
    mocks.discover.mockRejectedValueOnce(new DiscoveryError('QUOTA', 429)).mockResolvedValue(noAmapResults);
    mocks.rpc.mockImplementation((_name, args) => ({abortSignal: async () => ({
      data: entries(args.p_offset, args.p_offset ? 1 : 21), error: null
    })}));
    await act(async () => {await getHook().load(search);});
    expect(getHook().error).toBe('QUOTA');
    expect(getHook().result.catalog).toHaveLength(20);
    await act(async () => getHook().nextPage());
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await act(async () => {await getHook().retry();});
    expect(mocks.discover.mock.calls.map(([query]) => query.page)).toEqual([1, 1]);
    expect(mocks.rpc.mock.calls.map(([, args]) => args.p_offset)).toEqual([0, 0]);
    await act(async () => getHook().nextPage());
    expect(mocks.rpc.mock.calls.map(([, args]) => args.p_offset)).toEqual([0, 0, 20]);
    expect(getHook().result.catalog).toHaveLength(21);
    expect(getHook().result.catalogMore).toBe(false);
  });
});

it('ignores an old search even if the mock transport returns after being aborted', async () => {
  await withHook(async getHook => {
    let resolveOld!: (result: DiscoveryResult) => void;
    const old = new Promise<DiscoveryResult>(resolve => {resolveOld = resolve;});
    mocks.discover.mockReturnValueOnce(old).mockResolvedValueOnce(noAmapResults);
    mocks.rpc.mockReturnValue({abortSignal: async () => ({data: [], error: null})});
    await act(async () => {void getHook().load(search);});
    await act(async () => {await getHook().load({...search, city: '广州市'});});
    await act(async () => resolveOld({...noAmapResults, hasMore: true}));
    expect(getHook().result.scope).toMatchObject({city: '广州市'});
    expect(getHook().result.amapMore).toBe(false);
  });
});

it('stops at the catalog RPC offset boundary', () => {
  expect(hasMoreCatalogRows(21, 2000)).toBe(true);
  expect(hasMoreCatalogRows(21, 2020)).toBe(false);
});
