import {describe, expect, it} from 'vitest';
// The runner is plain Node.js so it can be used on Windows without another CLI.
// @ts-expect-error JavaScript test tooling has no declaration file.
import {percentile, summarizeSamples, assertIsolatedTarget} from '../../scripts/capacity/metrics.mjs';

describe('capacity measurement safeguards', () => {
  it('uses nearest-rank percentiles and never treats an empty sample as a fast response', () => {
    expect(percentile([100, 20, 40, 80, 60], 0.95)).toBe(100);
    expect(percentile([], 0.95)).toBeNull();
  });
  it('counts semantic failures even when HTTP returns success', () => {
    const result = summarizeSamples([{durationMs: 20, ok: true, status: 200, bytes: 10},
      {durationMs: 70, ok: false, status: 200, bytes: 10}, {durationMs: 110, ok: false, status: 503, bytes: 0}], 1000);
    expect(result.requests).toBe(3);
    expect(result.failures).toBe(2);
    expect(result.rps).toBe(3);
    expect(result.successP95Ms).toBe(20);
    expect(result.allP95Ms).toBe(110);
  });
  it('rejects public hosts, credentials and redirects as load-test targets', () => {
    expect(() => assertIsolatedTarget('https://www.aiden-macau-map.top')).toThrow();
    expect(() => assertIsolatedTarget('http://127.0.0.1.evil.test:56547')).toThrow();
    expect(() => assertIsolatedTarget('http://user:secret@127.0.0.1:56547')).toThrow();
    expect(assertIsolatedTarget('http://127.0.0.1:56547')).toBe('http://127.0.0.1:56547');
  });
});
