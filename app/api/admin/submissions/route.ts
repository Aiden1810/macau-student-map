import {createAdminSubmissionsGetHandler} from '@/lib/api/admin-submissions-route';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {readAccountEmails} from '@/lib/admin/accounts';

const COLUMNS = 'id,source_place_id,merged_into_place_id,name,address,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,status,submitted_by,version,submitted_at,reviewed_at,review_note,created_at,updated_at';

export const GET = createAdminSubmissionsGetHandler({
  requireAdmin,
  createClient: createAuthenticatedSupabaseClient,
  listPending: async (client) => {
    const {data, error} = await client
      .from('place_submissions')
      .select(COLUMNS)
      .eq('status', 'pending')
      .order('submitted_at', {ascending: true})
      .limit(200);
    if (error) return {data, error};
    try {
      const submitterEmails = await readAccountEmails(client, (data ?? []).map(row => row.submitted_by));
      return {data, error: null, submitterEmails};
    } catch {
      return {data: null, error: {message: '提交账号读取失败，请确认数据库迁移已安装。'}};
    }
  },
  countByStatus: async (client, status) => {
    const {count, error} = await client
      .from('place_submissions')
      .select('id', {count: 'exact', head: true})
      .eq('status', status);
    return {count, error};
  }
});
