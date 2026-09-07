import {createAdminSubmissionsGetHandler} from '@/lib/api/admin-submissions-route';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';

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
    return {data, error};
  },
  countByStatus: async (client, status) => {
    const {count, error} = await client
      .from('place_submissions')
      .select('id', {count: 'exact', head: true})
      .eq('status', status);
    return {count, error};
  }
});
