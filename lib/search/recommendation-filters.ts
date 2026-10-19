import type {Shop} from '../../types/shop';
import {matchesLaunchCategory} from '../domain/place-types';
import {deriveTrustLabel} from '../ranking/confidence';

export const RECOMMENDATION_LIMITS = {maxPrice: 30, recentDays: 7} as const;

function matchesRecommendation(value: string, place: Shop, now: number): boolean {
  if (value === '封神之作' || value === '强烈推荐') {
    if (!Number.isFinite(place.rating) || place.rating < 0 || place.rating > 5 ||
        !Number.isFinite(place.reviews) || !Number.isInteger(place.reviews)) return false;
    const trust = deriveTrustLabel(place.rating, place.reviews);
    return value === '封神之作' ? trust === 'excellent' : trust === 'recommended';
  }
  if (value === 'budget-30') {
    const price = place.pricePerPerson;
    return typeof price === 'number' && Number.isFinite(price) && price > 0 &&
      price <= RECOMMENDATION_LIMITS.maxPrice && matchesLaunchCategory(place, 'food');
  }
  if (value === 'recent-7-days') {
    if (!place.publishedAt) return false;
    const published = Date.parse(place.publishedAt);
    // First publication only: editing an old place does not make it newly collected.
    return Number.isFinite(published) && published <= now &&
      published >= now - RECOMMENDATION_LIMITS.recentDays * 86_400_000;
  }
  return false;
}

/** Same-group choices use OR. "All" is the union, including unreviewed budget/new places. */
export function filterRecommendedPlaces(selected: readonly string[], places: readonly Shop[], now = Date.now()): Shop[] {
  const values = selected.length > 0 ? selected : ['封神之作', '强烈推荐', 'budget-30', 'recent-7-days'];
  return places.filter(place => values.some(value => matchesRecommendation(value, place, now)));
}
