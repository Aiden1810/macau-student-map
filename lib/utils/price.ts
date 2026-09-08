export type PriceDisplay = {kind: 'none'} | {kind: 'free'} | {kind: 'paid'; value: number};

/**
 * Normalize an average-spend value for display. Only a finite positive number
 * is shown as a paid amount, exactly `0` is shown as free, and null / NaN /
 * undefined / negative values are hidden entirely.
 */
export function resolvePriceDisplay(pricePerPerson: unknown): PriceDisplay {
  if (typeof pricePerPerson !== 'number' || !Number.isFinite(pricePerPerson)) {
    return {kind: 'none'};
  }
  if (pricePerPerson === 0) {
    return {kind: 'free'};
  }
  if (pricePerPerson > 0) {
    return {kind: 'paid', value: pricePerPerson};
  }
  return {kind: 'none'};
}