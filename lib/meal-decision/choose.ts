import {chooseCatalogComparisonPlaces, comparePlaces, mealCandidateExclusion, type MealExclusion} from '@/lib/assistant/decision';
import {coordinatesSchema, type AssistantIntent, type AssistantOrigin, type AssistantPlace, type RouteSnapshot} from '@/lib/assistant/contracts';
import type {Shop} from '@/types/shop';

type Exclusions = Partial<Record<MealExclusion, number>>;

export function toMealCatalog(places: Shop[]): AssistantPlace[] {
  return places.filter(place => place.status === 'verified' && place.category === 'food').map(place => ({
    id: place.id,
    name: place.name,
    category: place.category,
    address: place.address,
    pricePerPerson: typeof place.pricePerPerson === 'number' && Number.isFinite(place.pricePerPerson) ? place.pricePerPerson : null,
    coordinates: place.hasCoordinates ? coordinatesSchema.safeParse(place.coordinates).data ?? null : null,
    tags: [...place.tags, ...(place.filterTags ?? []), ...(place.subTags ?? []), place.mainCategory ?? ''].filter(Boolean),
    source: 'catalog'
  }));
}

export function prepareMealChoice(places: AssistantPlace[], intent: AssistantIntent, origin: AssistantOrigin | null) {
  const withoutWalking = {...intent, maxWalkingMinutes: null};
  const excluded: Exclusions = {};
  const candidates: AssistantPlace[] = [];
  for (const row of comparePlaces(places, withoutWalking, []).rows) {
    const reason = mealCandidateExclusion(row, withoutWalking)
      ?? (intent.maxWalkingMinutes != null && !row.place.coordinates ? 'unknown_walking' : null);
    if (reason) excluded[reason] = (excluded[reason] ?? 0) + 1;
    else candidates.push(row.place);
  }
  const selected = chooseCatalogComparisonPlaces(candidates, intent, origin);
  return {candidates: selected, remaining: candidates.length - selected.length, excluded};
}

export function finishMealChoice(
  prepared: ReturnType<typeof prepareMealChoice>, intent: AssistantIntent, routes: RouteSnapshot[]
) {
  const excluded = {...prepared.excluded};
  const decision = comparePlaces(prepared.candidates, intent, routes);
  const matches = decision.rows.filter(row => {
    const reason = mealCandidateExclusion(row, intent);
    if (!reason) return true;
    excluded[reason] = (excluded[reason] ?? 0) + 1;
    return false;
  });
  const picked = decision.recommendedPlaceId;
  matches.sort((left, right) => Number(right.place.id === picked) - Number(left.place.id === picked));
  const walkingRequestFailed = routes.some(({walking}) => walking?.status === 'error' || walking?.status === 'timeout');
  return {matches, excluded, remaining: prepared.remaining, recommendedPlaceId: picked, walkingRequestFailed};
}
