import {describe, expect, it, vi} from 'vitest';
import {createRequestGuard} from '../../../lib/data/async-request';
import {COMMENTS_LOAD_ERROR, loadComments, normalizeComments} from '../../../lib/data/comments';

const rowA = {id: 'c-1', placeId: 'A', content: '好', rating: 5, createdAt: '2026-01-01T00:00:00Z'};

describe('normalizeComments', () => {
  it('maps review rows to Comment rows and fills defaults', () => {
    expect(
      normalizeComments([
        rowA,
        {id: 'c-2', placeId: 'A', content: null, rating: 0, createdAt: '2026-01-02T00:00:00Z'}
      ])
    ).toEqual([
      {id: 'c-1', shopId: 'A', content: '好', rating: 5, createdAt: '2026-01-01T00:00:00Z'},
      {id: 'c-2', shopId: 'A', content: '', rating: 0, createdAt: '2026-01-02T00:00:00Z'}
    ]);
  });

  it('returns an empty array for undefined rows', () => {
    expect(normalizeComments(undefined)).toEqual([]);
  });
});

describe('loadComments', () => {
  it('returns normalized items when the review load succeeds', async () => {
    const loadReviews = vi.fn(async () => ({ok: true, rows: [rowA], errorMessage: null}));

    const result = await loadComments('A', loadReviews);

    expect(loadReviews).toHaveBeenCalledWith('A');
    expect(result.error).toBeNull();
    expect(result.items).toEqual([
      {id: 'c-1', shopId: 'A', content: '好', rating: 5, createdAt: '2026-01-01T00:00:00Z'}
    ]);
  });

  it('surfaces a stable error when the payload is not ok', async () => {
    const loadReviews = vi.fn(async () => ({ok: false, rows: [], errorMessage: 'bad place'}));
    const result = await loadComments('A', loadReviews);

    expect(result.error).toBe('bad place');
    expect(result.items).toEqual([]);
  });

  it('surfaces the stable fallback error when the payload is not ok without a message', async () => {
    const loadReviews = vi.fn(async () => ({ok: false, rows: [], errorMessage: null}));
    const result = await loadComments('A', loadReviews);

    expect(result.error).toBe(COMMENTS_LOAD_ERROR);
    expect(result.items).toEqual([]);
  });

  it('ends loading with a stable error when the fetch rejects', async () => {
    const loadReviews = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await loadComments('A', loadReviews);

    expect(result.error).toBe(COMMENTS_LOAD_ERROR);
    expect(result.items).toEqual([]);
  });

  it('discards a stale place result via the request-guard token pattern', async () => {
    const guard = createRequestGuard();

    let resolveA!: (value: {ok: boolean; rows: Array<{id: string; placeId: string}>; errorMessage: null}) => void;
    const loadA = vi.fn(() => new Promise((resolve) => (resolveA = resolve)));

    // The page flow: a request for place A is started, then navigation to B
    // begins a newer generation before A resolves.
    const tokenA = guard.begin();
    const loadAStarted = loadComments('A', loadA as never);
    const tokenB = guard.begin();
    const loadB = await loadComments('B', async () => ({ok: true, rows: [{id: 'c-b', placeId: 'B'}], errorMessage: null}));

    resolveA({ok: true, rows: [{id: 'c-a', placeId: 'A'}], errorMessage: null});
    const resultA = await loadAStarted;

    // A's late result is no longer the current token, so it would be discarded
    // by the page's gating before touching comments state.
    expect(guard.isCurrent(tokenA)).toBe(false);
    expect(guard.isCurrent(tokenB)).toBe(true);
    expect(resultA.items.map((i) => i.shopId)).toEqual(['A']);
    expect(loadB.items.map((i) => i.shopId)).toEqual(['B']);
  });
});