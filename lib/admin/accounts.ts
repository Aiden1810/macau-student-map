import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';

export type AdminAccount = {id: string; email: string | null};
export const userDirectorySchema = z.object({
  total: z.number().int().nonnegative(), matched: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.number().int().min(1).max(50),
  items: z.array(z.object({
    id: z.string(), email: z.string().nullable(), createdAt: z.string().nullable(),
    role: z.enum(['member', 'admin'])
  })).max(50)
});
export type UserDirectory = z.infer<typeof userDirectorySchema>;
const emailRows = z.array(z.object({user_id: z.string(), email: z.string().nullable()}));

/** Batch lookup for admin-only responses. Never attach these fields to public place data. */
export async function readAccountEmails(client: SupabaseClient, ids: Array<string | null | undefined>): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!uniqueIds.length) return new Map();
  if (uniqueIds.length > 500) throw new Error('账号批次超过上限');
  const {data, error} = await client.rpc('admin_account_emails', {p_user_ids: uniqueIds});
  if (error) throw error;
  return new Map(emailRows.parse(data).map(row => [row.user_id, row.email]));
}
