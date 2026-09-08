import {describe, expect, it} from 'vitest';
import {resolvePriceDisplay} from '../../../lib/utils/price';

describe('resolvePriceDisplay', () => {
  it('shows exactly zero as free', () => {
    expect(resolvePriceDisplay(0)).toEqual({kind: 'free'});
  });

  it('shows a positive number as a paid amount', () => {
    expect(resolvePriceDisplay(58)).toEqual({kind: 'paid', value: 58});
    expect(resolvePriceDisplay(0.5)).toEqual({kind: 'paid', value: 0.5});
  });

  it('hides negative values', () => {
    expect(resolvePriceDisplay(-1)).toEqual({kind: 'none'});
  });

  it('hides null, undefined, NaN and non-finite values', () => {
    expect(resolvePriceDisplay(null)).toEqual({kind: 'none'});
    expect(resolvePriceDisplay(undefined)).toEqual({kind: 'none'});
    expect(resolvePriceDisplay(NaN)).toEqual({kind: 'none'});
    expect(resolvePriceDisplay(Number.POSITIVE_INFINITY)).toEqual({kind: 'none'});
  });

  it('hides non-number values', () => {
    expect(resolvePriceDisplay('58')).toEqual({kind: 'none'});
    expect(resolvePriceDisplay({})).toEqual({kind: 'none'});
  });
});