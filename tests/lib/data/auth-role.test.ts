import {describe, expect, it, vi} from 'vitest';
import {createRequestGuard} from '../../../lib/data/async-request';
import {loadAuthRole} from '../../../lib/data/auth-role';

describe('loadAuthRole', () => {
  it('returns signedOut when the user is already signed out', async () => {
    const result = await loadAuthRole(
      createRequestGuard(),
      async () => null,
      vi.fn()
    );

    expect(result).toEqual({isCurrent: true, signedOut: true, role: null});
  });

  it('applies the current user role when the same user is still signed in', async () => {
    const result = await loadAuthRole(
      createRequestGuard(),
      vi.fn().mockResolvedValue('user-1'),
      vi.fn().mockResolvedValue({role: 'admin', error: null})
    );

    expect(result).toEqual({isCurrent: true, signedOut: false, role: 'admin'});
  });

  it('does not restore admin once the user logs out while the profile query is running', async () => {
    const getUserId = vi
      .fn()
      .mockResolvedValueOnce('user-1') // user present at start
      .mockResolvedValueOnce(null); // signed out by the time the query returns
    const resolveRole = vi.fn().mockResolvedValue({role: 'admin', error: null});

    const result = await loadAuthRole(createRequestGuard(), getUserId, resolveRole);

    expect(resolveRole).toHaveBeenCalledWith('user-1');
    expect(result.signedOut).toBe(true);
    expect(result.role).toBeNull();
    // The caller clears any stale admin on signedOut.
    expect(result.isCurrent).toBe(true);
  });

  it('never grants a role to a different user than the one that started the query', async () => {
    const getUserId = vi
      .fn()
      .mockResolvedValueOnce('user-1')
      .mockResolvedValueOnce('user-2'); // account switched mid-query
    const resolveRole = vi.fn().mockResolvedValue({role: 'admin', error: null});

    const result = await loadAuthRole(createRequestGuard(), getUserId, resolveRole);

    expect(result.role).toBeNull();
    expect(result.signedOut).toBe(false);
  });

  it('marks an invalidated request as stale so the page does not apply it', async () => {
    const guard = createRequestGuard();
    let resolveProfile!: (value: {role: string; error: null}) => void;
    const getUserId = vi.fn().mockResolvedValue('user-1');
    const resolveRole = vi.fn(
      () => new Promise<{role: string; error: null}>((resolve) => (resolveProfile = resolve))
    );

    const pending = loadAuthRole(guard, getUserId, resolveRole);
    // Let the initial user lookup resolve so the profile query is in flight.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // A newer auth check (or logout) invalidates this request before it returns.
    guard.invalidate();
    resolveProfile({role: 'admin', error: null});

    const result = await pending;
    expect(result.isCurrent).toBe(false);
    expect(result.role).toBeNull();
  });

  it('does not restore admin when the profile lookup itself errors', async () => {
    const result = await loadAuthRole(
      createRequestGuard(),
      vi.fn().mockResolvedValue('user-1'),
      vi.fn().mockResolvedValue({role: null, error: 'relation profiles does not exist'})
    );

    expect(result).toEqual({isCurrent: true, signedOut: false, role: null});
  });
});