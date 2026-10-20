// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useDiscoveryRefresh} from '../../../lib/hooks/useDiscoveryRefresh';

let host: HTMLDivElement;
let root: Root;
let visible: boolean;
let online: boolean;
const refresh = vi.fn<() => Promise<void>>();
function Probe({callback = refresh}: {callback?: () => Promise<void>}) {
  useDiscoveryRefresh(callback);
  return null;
}
async function event(type: string, target: EventTarget = window) {
  await act(async () => {target.dispatchEvent(new Event(type));});
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  visible = true; online = true; refresh.mockReset().mockResolvedValue(undefined);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden');
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers();
});

describe('event-driven discovery refresh without polling', () => {
  it('does not load on mount or as time passes, and throttles focus/visibility events', async () => {
    await act(async () => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(120000));
    expect(refresh).not.toHaveBeenCalled();
    await event('focus'); await event('visibilitychange', document); await event('online');
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(59999));
    await event('focus'); expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1));
    await event('focus'); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('waits for a visible online page and refreshes after reconnecting', async () => {
    await act(async () => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(60000));
    visible = false; await event('focus'); await event('visibilitychange', document);
    visible = true; online = false; await event('visibilitychange', document);
    expect(refresh).not.toHaveBeenCalled();
    online = true; await event('online'); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('prevents overlapping work and consumes failures without a retry loop', async () => {
    let reject!: (error: Error) => void;
    refresh.mockImplementationOnce(() => new Promise((_resolve, fail) => {reject = fail;}));
    await act(async () => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(60000));
    await event('focus');
    await act(async () => vi.advanceTimersByTime(120000));
    await event('focus'); expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('offline')));
    await event('focus'); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('uses the latest callback without resetting the cooldown and removes listeners on unmount', async () => {
    const next = vi.fn(async () => undefined);
    await act(async () => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(60000));
    await act(async () => root.render(<Probe callback={next} />));
    await event('focus'); expect(next).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTime(120000));
    await event('focus'); await event('visibilitychange', document); await event('online');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
