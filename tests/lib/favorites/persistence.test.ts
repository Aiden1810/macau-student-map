import {describe, expect, it} from 'vitest';
import {persistFavoriteChange} from '../../../lib/favorites/persistence';

function fixture(initial: string[] = []) {
  let current = initial;
  let stored = JSON.stringify(initial);
  return {
    read: () => current,
    commit: (next: string[]) => {current = next;},
    writeLocal: (next: string[]) => {stored = JSON.stringify(next);},
    stored: () => JSON.parse(stored),
  };
}

describe('persisting favorite changes before success feedback', () => {
  it('saves an anonymous favorite before committing the visible state', async () => {
    const state = fixture(['other']);
    expect(await persistFavoriteChange('shop', true, state)).toBe('success');
    expect(state.read()).toEqual(['other', 'shop']);
    expect(state.stored()).toEqual(['other', 'shop']);
  });
  it('removes just the selected favorite', async () => {
    const state = fixture(['shop', 'other']);
    expect(await persistFavoriteChange('shop', false, state)).toBe('success');
    expect(state.stored()).toEqual(['other']);
  });
  it('does not announce success or change the heart when anonymous storage fails', async () => {
    const state = fixture(['other']);
    expect(await persistFavoriteChange('shop', true, {...state, writeLocal: () => {throw new Error('quota');}})).toBe('local_error');
    expect(state.read()).toEqual(['other']);
  });
  it('preserves both visible and cached state when remote saving fails', async () => {
    const state = fixture(['other']);
    expect(await persistFavoriteChange('shop', true, {...state, syncRemote: async () => {throw new Error('offline');}})).toBe('remote_error');
    expect(state.read()).toEqual(['other']);
    expect(state.stored()).toEqual(['other']);
  });
  it('does not falsely remove an existing favorite when remote deletion fails', async () => {
    const state = fixture(['shop', 'other']);
    expect(await persistFavoriteChange('shop', false, {...state, syncRemote: async () => {throw new Error('denied');}})).toBe('remote_error');
    expect(state.read()).toEqual(['shop', 'other']);
  });
  it('keeps a successful account save usable even if the browser cache is blocked', async () => {
    const state = fixture();
    expect(await persistFavoriteChange('shop', true, {...state, syncRemote: async () => {}, writeLocal: () => {throw new Error('blocked');}})).toBe('success');
    expect(state.read()).toEqual(['shop']);
  });
  it('merges overlapping successful requests without losing another shop', async () => {
    const state = fixture(['existing']);
    let finishA!: () => void;
    const requestA = persistFavoriteChange('a', true, {...state, syncRemote: () => new Promise<void>(resolve => {finishA = resolve;})});
    await persistFavoriteChange('b', true, {...state, syncRemote: async () => {}});
    finishA();
    await requestA;
    expect(state.read()).toEqual(['existing', 'b', 'a']);
    expect(state.stored()).toEqual(['existing', 'b', 'a']);
  });
  it('discards a late result after the user account changes', async () => {
    const state = fixture(['other']);
    expect(await persistFavoriteChange('shop', true, {...state, syncRemote: async () => {}, isCurrent: () => false})).toBe('cancelled');
    expect(state.read()).toEqual(['other']);
    expect(state.stored()).toEqual(['other']);
  });
});
