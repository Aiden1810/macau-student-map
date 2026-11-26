import {expect, it} from 'vitest';
import {rankTasteExploration} from '@/lib/meal-history/exploration';
import type {MealDraft} from '@/lib/meal-history/model';

const places = [
  {id: 'repeat', name: 'Cafe A', category: 'food', tags: ['火锅'], status: 'verified'},
  {id: 'new-hotpot', name: 'Cafe B', category: 'food', tags: ['火鍋'], status: 'verified'},
  {id: 'new-pasta', name: 'Cafe C', category: 'food', tags: ['西餐'], status: 'verified'},
  {id: 'preferred', name: 'Cafe D', category: 'food', tags: ['日本料理'], status: 'verified'},
  {id: 'excluded', name: 'Cafe E', category: 'food', tags: ['炸鸡'], status: 'verified'},
  {id: 'unpublished', name: 'Draft Cafe', category: 'food', tags: [], status: 'pending'},
  {id: 'service', name: 'Copy shop', category: 'service', tags: ['打印'], status: 'verified'},
];

it('ranks variety using recent meals and saved tastes while avoiding explicitly excluded choices', () => {
  const entry: MealDraft = {restaurant_name: ' cafe a ', cuisine: '火锅', eaten_on: '2026-11-22', feedback: 'liked', note: ''};
  const result = rankTasteExploration(places, [
    entry, {...entry, restaurant_name: 'Cafe C', cuisine: '西餐', eaten_on: '2026-10-22'},
  ], [
    {kind: 'cuisine', label: '日本料理', sentiment: 'like'},
    {kind: 'flavor', label: '炸鸡', sentiment: 'avoid'},
  ], '2026-11-25');
  expect(result.map(({place, recent}) => [place.id, recent])).toEqual([
    ['preferred', 'new'], ['new-pasta', 'new'], ['new-hotpot', 'cuisine'], ['repeat', 'restaurant'],
  ]);
});
