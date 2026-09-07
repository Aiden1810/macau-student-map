export interface ComponentLifecycleGuard {
  activate(): void;
  deactivate(): void;
  isActive(): boolean;
  tryBeginExclusive(): boolean;
  finishExclusive(): void;
}

export function createComponentLifecycleGuard(): ComponentLifecycleGuard {
  let active = false;
  let exclusiveBusy = false;

  return {
    activate() {
      active = true;
    },
    deactivate() {
      active = false;
      exclusiveBusy = false;
    },
    isActive() {
      return active;
    },
    tryBeginExclusive() {
      if (!active || exclusiveBusy) return false;
      exclusiveBusy = true;
      return true;
    },
    finishExclusive() {
      exclusiveBusy = false;
    }
  };
}
