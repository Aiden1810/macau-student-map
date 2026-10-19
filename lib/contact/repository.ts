import type {SupabaseClient} from '@supabase/supabase-js';
import {FEEDBACK_COLUMNS, FEEDBACK_PAGE_SIZE, type FeedbackFilter, type FeedbackRecord, type FeedbackStatus, type FeedbackWrite} from './feedback';

export async function insertFeedback(client: SupabaseClient, input: FeedbackWrite) {
  const {data, error} = await client.from('user_feedback').insert({id: input.id, user_id: input.userId, category: input.category, place: input.place, message: input.message, reply_to: input.replyTo, locale: input.locale}).select(FEEDBACK_COLUMNS).single();
  return {data: data as FeedbackRecord | null, error};
}
export async function findOwnFeedback(client: SupabaseClient, id: string, userId: string) {
  const {data, error} = await client.from('user_feedback').select(FEEDBACK_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle();
  return {data: data as FeedbackRecord | null, error};
}
export async function listFeedback(client: SupabaseClient, status: FeedbackFilter, page: number) {
  let query = client.from('user_feedback').select(FEEDBACK_COLUMNS, {count: 'exact'});
  if (status !== 'all') query = query.eq('status', status);
  const {data, count, error} = await query.order('created_at', {ascending: false}).order('id', {ascending: false}).range(page * FEEDBACK_PAGE_SIZE, (page + 1) * FEEDBACK_PAGE_SIZE - 1);
  return {data: data as FeedbackRecord[] | null, count, error};
}
export async function countFeedback(client: SupabaseClient, status: FeedbackStatus) {
  const {count, error} = await client.from('user_feedback').select('id', {count: 'exact', head: true}).eq('status', status);
  return {count, error};
}
export async function updateFeedback(client: SupabaseClient, id: string, input: {status: FeedbackStatus; expectedStatus: FeedbackStatus; actorId: string}) {
  const {data, error} = await client.from('user_feedback').update({status: input.status, handled_at: input.status === 'resolved' ? new Date().toISOString() : null, handled_by: input.status === 'resolved' ? input.actorId : null}).eq('id', id).eq('status', input.expectedStatus).select(FEEDBACK_COLUMNS).maybeSingle();
  return {data: data as FeedbackRecord | null, error};
}
