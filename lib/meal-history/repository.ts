import {supabase} from '@/lib/supabase';
import type {MealDraft, MealEntry, PreferenceDraft, TastePreference} from './model';

const pageSize = 25;
const mealColumns = 'id,restaurant_name,cuisine,eaten_on,feedback,note';
const tasteColumns = 'id,kind,label,sentiment';

export async function readMeals(userId: string, page: number) {
  const start = page * pageSize;
  const {data, error} = await supabase.from('meal_history').select(mealColumns).eq('user_id', userId)
    .order('eaten_on', {ascending: false}).order('created_at', {ascending: false}).order('id', {ascending: false})
    .range(start, start + pageSize);
  if (error) throw error;
  const entries = (data ?? []) as MealEntry[];
  return {items: entries.slice(0, pageSize), hasMore: entries.length > pageSize};
}

export async function readPreferences(userId: string) {
  const {data, error} = await supabase.from('meal_taste_preferences').select(tasteColumns)
    .eq('user_id', userId).order('kind').order('label');
  if (error) throw error;
  return (data ?? []) as TastePreference[];
}

export async function saveMeal(userId: string, id: string, draft: MealDraft, editing: boolean) {
  if (!editing) {
    const {data, error} = await supabase.from('meal_history').upsert(
      {...draft, id, user_id: userId}, {onConflict: 'id', ignoreDuplicates: true}
    ).select('id').maybeSingle();
    if (error) throw error;
    if (data) return;
  }
  const {data, error} = await supabase.from('meal_history').update(draft)
    .eq('user_id', userId).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw error ?? new Error('Meal not found');
}

export async function savePreference(userId: string, id: string, draft: PreferenceDraft, editing: boolean) {
  if (!editing) {
    const {data, error} = await supabase.from('meal_taste_preferences').upsert(
      {...draft, id, user_id: userId}, {onConflict: 'id', ignoreDuplicates: true}
    ).select('id').maybeSingle();
    if (error) throw error;
    if (data) return;
  }
  const {data, error} = await supabase.from('meal_taste_preferences').update(draft)
    .eq('user_id', userId).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw error ?? new Error('Preference not found');
}

export async function deleteMealJournalItem(userId: string, kind: 'meal' | 'taste', id: string) {
  const table = kind === 'meal' ? 'meal_history' : 'meal_taste_preferences';
  const {error} = await supabase.from(table).delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
