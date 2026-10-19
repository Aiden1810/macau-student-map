export type TrustLabel = 'unrated' | 'limited' | 'excellent' | 'recommended' | 'standard';

export const TRUST_THRESHOLDS = {minimumReviews: 5, excellent: 4.8, recommended: 4.3} as const;

export function calculateConfidenceScore(
  average: number | null,
  count: number,
  globalAverage = 4,
  priorWeight = 5
): number | null {
  if (average === null || !Number.isFinite(average) || count <= 0) return null;
  const safeCount = Math.max(0, count);
  const safePrior = Math.max(0, priorWeight);
  return (
    (safeCount / (safeCount + safePrior)) * average +
    (safePrior / (safeCount + safePrior)) * globalAverage
  );
}
export function deriveTrustLabel(average: number | null, count: number): TrustLabel {
  if (average === null || count <= 0) return 'unrated';
  if (count < TRUST_THRESHOLDS.minimumReviews) return 'limited';
  if (average >= TRUST_THRESHOLDS.excellent) return 'excellent';
  if (average >= TRUST_THRESHOLDS.recommended) return 'recommended';
  return 'standard';
}
