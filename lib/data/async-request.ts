export interface RequestGuard {
  begin(): number;
  isCurrent(token: number): boolean;
  invalidate(): void;
}

/**
 * Monotonic request generation guard. Each `begin()` advances the generation,
 * so the tokens handed out before it are considered stale and `isCurrent`
 * returns false for them.
 */
export function createRequestGuard(): RequestGuard {
  let latest = 0;
  return {
    begin() {
      latest += 1;
      return latest;
    },
    isCurrent(token) {
      return token === latest;
    },
    invalidate() {
      latest += 1;
    }
  };
}

/**
 * Run `task` under a request guard and return its result only if it is still
 * the freshest request. If a newer request started (or the guard was
 * invalidated) before `task` resolved, returns null so the caller must discard
 * the (now stale) result and never apply it to the UI.
 */
export async function runLatest<T>(guard: RequestGuard, task: () => Promise<T>): Promise<T | null> {
  const token = guard.begin();
  const result = await task();
  return guard.isCurrent(token) ? result : null;
}