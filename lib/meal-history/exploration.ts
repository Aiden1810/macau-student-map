import {matchesLaunchCategory, type PlaceTypeInput} from '@/lib/domain/place-types';
import {normalizeSearchText, resolveTagAlias} from '@/lib/domain/taxonomy';
import type {MealDraft, PreferenceDraft} from './model';

type ExplorationPlace = PlaceTypeInput & {name: string; status: string; filterTags?: readonly string[]};
type RecentMatch = 'restaurant' | 'cuisine' | 'new';

const tagKeys = (value: string) => [normalizeSearchText(value), ...resolveTagAlias(value).map(tag => tag.slug)].filter(Boolean);
const nameKey = (value: string) => normalizeSearchText(value).replace(/[\s\p{P}\p{S}]+/gu, '');

export function rankTasteExploration<T extends ExplorationPlace>(
  places: readonly T[], meals: readonly MealDraft[], preferences: readonly PreferenceDraft[], today: string
) {
  const since = new Date(Date.parse(today) - 13 * 86_400_000).toISOString().slice(0, 10);
  const recentMeals = meals.filter(meal => meal.eaten_on >= since && meal.eaten_on <= today);
  const recentNames = new Set(recentMeals.map(meal => nameKey(meal.restaurant_name)));
  const recentCuisines = new Set(recentMeals.flatMap(meal => tagKeys(meal.cuisine)));
  const saved = preferences.map(preference => ({
    ...preference,
    keys: preference.kind === 'restaurant' ? [nameKey(preference.label)] : tagKeys(preference.label)
  }));

  const ranked: Array<{place: T; recent: RecentMatch; score: number}> = [];
  for (const place of places) {
    if (place.status !== 'verified' || !matchesLaunchCategory(place, 'food') ||
        /暂停营业|暫停營業|已停业|已停業|已结业|已結業|permanently closed/i.test(place.name)) continue;
    const name = nameKey(place.name);
    const tags = new Set([...place.tags, ...(place.filterTags ?? []), ...(place.subTags ?? []), place.mainCategory ?? ''].flatMap(tagKeys));
    const matches = saved.filter(item => item.kind === 'restaurant'
      ? item.keys.includes(name) : item.keys.some(key => tags.has(key)));
    if (matches.some(item => item.sentiment === 'avoid')) continue;

    const recent = recentNames.has(name) ? 'restaurant'
      : [...recentCuisines].some(key => tags.has(key)) ? 'cuisine' : 'new';
    const penalty = recent === 'restaurant' ? 4 : recent === 'cuisine' ? 2 : 0;
    ranked.push({place, recent, score: Number(matches.some(item => item.sentiment === 'like')) - penalty});
  }

  return ranked.sort((left, right) => right.score - left.score);
}
