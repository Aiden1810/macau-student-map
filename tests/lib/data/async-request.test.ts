import {describe, expect, it, vi} from 'vitest';
import {createRequestGuard, runLatest} from '../../../lib/data/async-request';

describe('createRequestGuard', () => {
  it('reports a just-started token as current', () => {
    const guard = createRequestGuard();
    const token = guard.begin();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it('marks older tokens as stale once a newer request begins', () => {
    const guard = createRequestGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('invalidates the in-flight token after invalidate()', () => {
    const guard = createRequestGuard();
    const token = guard.begin();
    guard.invalidate();

    expect(guard.isCurrent(token)).toBe(false);
  });
});

describe('runLatest', () => {
  it('returns the task result while it is still the freshest request', async () => {
    const guard = createRequestGuard();
    const result = await runLatest(guard, async () => 'shop-A');
    expect(result).toBe('shop-A');
  });

  it('does not let an older request override a newer one', async () => {
    const guard = createRequestGuard();

    let resolveFirst!: (value: string) => void;
    const first = runLatest(
      guard,
      () => new Promise<string>((resolve) => (resolveFirst = resolve))
    );
    const second = runLatest(guard, async () => 'shop-B');

    // The second request begins before the first one resolves; the first one
    // must be discarded even though its promise resolves last.
    resolveFirst('shop-A');

    expect(await first).toBeNull();
    expect(await second).toBe('shop-B');
  });

  it('returns null when the guard was invalidated while the task ran', async () => {
    const guard = createRequestGuard();

    let release!: () => void;
    const promise = runLatest(
      guard,
      () => new Promise<string>((resolve) => (release = () => resolve('late')))
    );

    guard.invalidate();
    release();

    expect(await promise).toBeNull();
  });

  it('calls the task exactly once per invocation', async () => {
    const guard = createRequestGuard();
    const task = vi.fn(async () => 'ok');

    await runLatest(guard, task);
    await runLatest(guard, task);

    expect(task).toHaveBeenCalledTimes(2);
  });
});