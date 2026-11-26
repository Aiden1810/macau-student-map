import {z} from 'zod';

export const mealHistoryEnabled = process.env.NEXT_PUBLIC_MEAL_HISTORY_ENABLED === 'true';
export const mealFeedback = ['liked', 'neutral', 'disliked'] as const;
export const preferenceKinds = ['restaurant', 'cuisine', 'flavor'] as const;
export const preferenceSentiments = ['like', 'avoid'] as const;

export const mealDraftSchema = z.object({
  restaurant_name: z.string().trim().min(1).max(120),
  cuisine: z.string().trim().max(80),
  eaten_on: z.iso.date(),
  feedback: z.enum(mealFeedback).nullable(),
  note: z.string().trim().max(280)
});
export type MealDraft = z.infer<typeof mealDraftSchema>;
export type MealEntry = MealDraft & {id: string};

export const preferenceDraftSchema = z.object({
  kind: z.enum(preferenceKinds),
  label: z.string().trim().min(1).max(120),
  sentiment: z.enum(preferenceSentiments)
});
export type PreferenceDraft = z.infer<typeof preferenceDraftSchema>;
export type TastePreference = PreferenceDraft & {id: string};

export function macauToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Macau', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts();
  const find = (type: string) => parts.find(part => part.type === type)?.value;
  return `${find('year')}-${find('month')}-${find('day')}`;
}

export function suggestTastePreferences(
  meals: readonly MealDraft[],
  saved: readonly PreferenceDraft[]
): PreferenceDraft[] {
  const key = (kind: PreferenceDraft['kind'], label: string) => `${kind}:${label.trim().toLowerCase()}`;
  const savedKeys = new Set(saved.map(item => key(item.kind, item.label)));
  const topics = new Map<string, {kind: PreferenceDraft['kind']; label: string; likes: number; dislikes: number}>();
  for (const meal of meals) {
    if (!meal.feedback || meal.feedback === 'neutral') continue;
    const fields = [['restaurant', meal.restaurant_name], ['cuisine', meal.cuisine]] as const;
    for (const [kind, value] of fields) {
      const label = value.trim();
      const id = key(kind, label);
      if (!label || savedKeys.has(id)) continue;
      const topic = topics.get(id) ?? {kind, label, likes: 0, dislikes: 0};
      if (meal.feedback === 'liked') topic.likes++;
      else topic.dislikes++;
      topics.set(id, topic);
    }
  }
  return [...topics.values()].flatMap<PreferenceDraft>(({kind, label, likes, dislikes}) => {
    if (likes >= 2 && !dislikes) return [{kind, label, sentiment: 'like'}];
    if (dislikes >= 2 && !likes) return [{kind, label, sentiment: 'avoid'}];
    return [];
  });
}
