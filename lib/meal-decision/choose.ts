import {chooseCatalogComparisonPlaces, comparePlaces, mealCandidateExclusion, type MealExclusion} from '@/lib/assistant/decision';
import {coordinatesSchema, type AssistantIntent, type AssistantOrigin, type AssistantPlace, type RouteSnapshot} from '@/lib/assistant/contracts';
import {normalizeSearchText, resolveTagAlias} from '@/lib/domain/taxonomy';
import type {PreferenceDraft} from '@/lib/meal-history/model';
import type {Shop} from '@/types/shop';

type Exclusions = Partial<Record<MealExclusion, number>>;

const tagKeys = (value: string) => [normalizeSearchText(value), ...resolveTagAlias(value).map(tag => tag.slug)].filter(Boolean);
const nameKey = (value: string) => normalizeSearchText(value).replace(/[\s\p{P}\p{S}]+/gu, '');

export function splitFoodTerms(raw: string): string[] {
  return [...new Set(raw.split(/[,，、;；/\n]+/).map(item => item.trim()).filter(Boolean))].slice(0, 8);
}

export function applyTastePreferencesToCatalog(
  places: readonly AssistantPlace[],
  preferences: readonly PreferenceDraft[]
): {places: AssistantPlace[]; avoidedCount: number} {
  if (!preferences.length) return {places: [...places], avoidedCount: 0};
  const saved = preferences.map(preference => ({
    ...preference,
    keys: preference.kind === 'restaurant' ? [nameKey(preference.label)] : tagKeys(preference.label)
  }));
  const kept: Array<{place: AssistantPlace; liked: boolean; index: number}> = [];
  let avoidedCount = 0;

  places.forEach((place, index) => {
    const name = nameKey(place.name);
    const tags = new Set(place.tags.flatMap(tagKeys));
    const matches = saved.filter(item => item.kind === 'restaurant'
      ? item.keys.includes(name) : item.keys.some(key => tags.has(key)));
    if (matches.some(item => item.sentiment === 'avoid')) {
      avoidedCount += 1;
      return;
    }
    kept.push({place, liked: matches.some(item => item.sentiment === 'like'), index});
  });

  kept.sort((left, right) => Number(right.liked) - Number(left.liked) || left.index - right.index);
  return {places: kept.map(item => item.place), avoidedCount};
}

export function nextCandidateId(ids: readonly string[], currentId: string | null): string | null {
  if (!ids.length) return null;
  if (!currentId) return ids[0];
  const index = ids.indexOf(currentId);
  return ids[(index + 1) % ids.length];
}

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
  const walkingRateLimited = routes.some(({walking}) => walking?.status === 'rate_limited');
  return {matches, excluded, remaining: prepared.remaining, recommendedPlaceId: picked, walkingRequestFailed, walkingRateLimited};
}
