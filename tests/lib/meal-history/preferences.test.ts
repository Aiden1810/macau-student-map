import {expect, it} from 'vitest';
import {mealDraftSchema, suggestTastePreferences, type MealDraft} from '@/lib/meal-history/model';

const entry = (restaurant_name: string, cuisine: string, feedback: MealDraft['feedback']): MealDraft => ({
  restaurant_name, cuisine, feedback, eaten_on: '2026-11-24', note: ''
});

it('suggests repeated tastes from confirmed feedback and leaves saved preferences alone', () => {
  const pastMeals = [
    entry('Cafe A', 'Cantonese', 'liked'),
    entry(' cafe a ', 'Cantonese', 'liked'),
    entry('Cafe B', 'Hot Pot', 'disliked'),
    entry('Cafe C', 'Hot Pot', 'disliked'),
    entry('Cafe D', 'Portuguese', 'neutral'),
  ];
  expect(suggestTastePreferences(pastMeals, [{kind: 'cuisine', label: 'cantonese', sentiment: 'avoid'}])).toEqual([
    {kind: 'restaurant', label: 'Cafe A', sentiment: 'like'},
    {kind: 'cuisine', label: 'Hot Pot', sentiment: 'avoid'},
  ]);
});

it('does not infer a taste from a single meal or conflicting feedback', () => {
  expect(suggestTastePreferences([
    entry('Cafe A', 'Cantonese', 'liked'),
    entry('Cafe A', 'Cantonese', 'liked'),
    entry('Cafe A', 'Cantonese', 'disliked'),
    entry('Cafe B', 'Hot Pot', 'disliked'),
  ], [])).toEqual([]);
});

it('accepts valid meal dates and bounds user-authored content', () => {
  expect(mealDraftSchema.safeParse(entry('Cafe', '', null)).success).toBe(true);
  expect(mealDraftSchema.safeParse({...entry('Cafe', '', null), eaten_on: '2026-02-30'}).success).toBe(false);
  expect(mealDraftSchema.safeParse(entry(' ', '', null)).success).toBe(false);
});
