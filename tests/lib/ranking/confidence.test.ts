import {describe, expect, it} from 'vitest';
import {calculateConfidenceScore, deriveTrustLabel} from '../../../lib/ranking/confidence';

describe('rating confidence', () => {
  it('keeps unrated places unrated', () => {
    expect(calculateConfidenceScore(null, 0)).toBeNull();
    expect(deriveTrustLabel(null, 0)).toBe('unrated');
  });

  it('does not call one five-star review legendary', () => {
    expect(calculateConfidenceScore(5, 1)).toBeCloseTo(4.1667, 4);
    expect(deriveTrustLabel(5, 1)).toBe('limited');
  });

  it('allows a sufficiently supported 4.9 average to qualify', () => {
    expect(deriveTrustLabel(4.9, 5)).toBe('excellent');
  });

  it('increases monotonically as evidence supports an above-average rating', () => {
    const one = calculateConfidenceScore(4.8, 1)!;
    const ten = calculateConfidenceScore(4.8, 10)!;
    const hundred = calculateConfidenceScore(4.8, 100)!;
    expect(one).toBeLessThan(ten);
    expect(ten).toBeLessThan(hundred);
  });
});
