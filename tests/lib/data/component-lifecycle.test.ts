import {describe, expect, it} from 'vitest';
import {createComponentLifecycleGuard} from '../../../lib/data/component-lifecycle';

describe('createComponentLifecycleGuard', () => {
  it('blocks work after deactivation and permits work after React-style reactivation', () => {
    const guard = createComponentLifecycleGuard();

    guard.activate();
    expect(guard.isActive()).toBe(true);
    guard.deactivate();
    expect(guard.isActive()).toBe(false);
    expect(guard.tryBeginExclusive()).toBe(false);

    guard.activate();
    expect(guard.isActive()).toBe(true);
  });

  it('allows only one exclusive operation until it is finished', () => {
    const guard = createComponentLifecycleGuard();
    guard.activate();

    expect(guard.tryBeginExclusive()).toBe(true);
    expect(guard.tryBeginExclusive()).toBe(false);
    guard.finishExclusive();
    expect(guard.tryBeginExclusive()).toBe(true);
  });
});
