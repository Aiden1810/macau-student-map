import type {SupabaseClient} from '@supabase/supabase-js';
import {summarizeQuality, summarizeSearches, summarizeVisits, type AuditItem, type DataBlock,
  type OperationsReport, type QualityRow, type SearchRow, type VisitRow} from './operations';
import {trafficStart, type TrafficRange} from './traffic';

type RowResult<T> = {data: T[] | null; count: number | null; error: unknown};

/** Offset pagination is bounded; exact counts expose truncation, including server-side row limits. */
export async function readRows<T>(query: (from: number, to: number) => PromiseLike<RowResult<T>>, cap: number) {
  const rows: T[] = [];
  let total: number | null = null;
  while (rows.length < cap) {
    const result = await query(rows.length, Math.min(rows.length + 499, cap - 1));
    if (result.error) throw result.error;
    total = result.count;
    const page = result.data ?? [];
    rows.push(...page);
    if (!page.length || (total !== null && rows.length >= total)) break;
  }
  return {rows, total, incomplete: total === null || total > rows.length};
}

function unavailable<T>(message: string): DataBlock<T> {
  return {data: null, loaded: 0, total: null, incomplete: false, error: message};
}
async function readBlock<T, R>(load: () => ReturnType<typeof readRows<T>>, summarize: (rows: T[]) => R,
  failureMessage?: (error: unknown) => string): Promise<DataBlock<R>> {
  try {
    const {rows, total, incomplete} = await load();
    return {data: summarize(rows), loaded: rows.length, total, incomplete, error: null};
  } catch (error) {return unavailable(failureMessage?.(error) ?? '读取失败，请刷新重试；失败不代表没有数据。');}
}

const ACTION_LABELS: Record<string, string> = {
  'place.create': '新增地点', 'place.edit': '编辑地点', 'place.publish': '上线地点', 'place.archive': '下线地点',
  'place.image_remove': '移除地点图片', 'submission.publish_edited': '编辑并发布投稿',
  'submission.approve': '通过投稿', 'submission.reject': '驳回投稿', 'submission.merge': '合并投稿',
  'review.approve': '通过评价', 'review.reject': '隐藏评价',
  create: '新增地点', edit: '编辑地点', approve: '通过审核', reject: '驳回审核', delete: '删除',
};
type AuditRow = {id: string | number; actor_id: string | null; action: string; entity_type: string | null;
  entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string};
export function auditItems(rows: AuditRow[]): AuditItem[] {
  const entityLabels: Record<string, string> = {place: '地点', review: '评价', submission: '投稿', place_submission: '投稿', shop: '历史店铺'};
  return rows.map(row => {
    const nested = row.metadata?.after ?? row.metadata?.published;
    const nestedName = nested && typeof nested === 'object' ? (nested as Record<string, unknown>).name : null;
    const name = row.metadata?.place_name ?? row.metadata?.shop_name ?? row.metadata?.name ?? nestedName;
    return {id: String(row.id), action: ACTION_LABELS[row.action] ?? row.action,
      entity: entityLabels[row.entity_type ?? ''] ?? '管理操作',
      target: typeof name === 'string' && name.trim() ? name : row.entity_id ? `编号 ${row.entity_id.slice(0, 8)}` : '—',
      actor: row.actor_id ? `管理员 ${row.actor_id.slice(0, 8)}` : '未记录操作者', createdAt: row.created_at};
  });
}

export async function readOperations(client: SupabaseClient, range: TrafficRange, now: number, signal: AbortSignal): Promise<OperationsReport> {
  const since = new Date(trafficStart(range, now)).toISOString();
  const until = new Date(now).toISOString();
  const [traffic, searches, quality, pendingReviews, activity] = await Promise.all([
    readBlock<VisitRow, ReturnType<typeof summarizeVisits>>(() => readRows<VisitRow>((from, to) => client
      .from('site_traffic_events').select('id,created_at,path,session_id,user_agent,referrer,user_id', {count: 'exact'})
      .eq('event_type', 'page_view').gte('created_at', since).lte('created_at', until)
      .order('created_at', {ascending: false}).order('id').range(from, to).abortSignal(signal), 5000), rows => summarizeVisits(rows, range, now)),
    readBlock<SearchRow, ReturnType<typeof summarizeSearches>>(() => readRows<SearchRow>((from, to) => client
      .from('search_events').select('id,query,normalized_query,result_count', {count: 'exact'})
      .gte('created_at', since).lte('created_at', until).order('created_at', {ascending: false}).order('id')
      .range(from, to).abortSignal(signal), 5000), summarizeSearches,
    error => (error as {code?: string})?.code === '42501'
      ? '搜索统计读取权限尚未启用，需安装本次管理员搜索读取迁移。'
      : '搜索记录读取失败，请刷新重试；失败不代表没有搜索。'),
    readBlock<QualityRow, ReturnType<typeof summarizeQuality>>(() => readRows<QualityRow>((from, to) => client
      .from('places').select('id,name,status,address,longitude,latitude,legacy_image_urls,place_media(lifecycle_status)', {count: 'exact'})
      .order('updated_at', {ascending: false}).order('id')
      .range(from, to).abortSignal(signal), 500), summarizeQuality),
    (async (): Promise<DataBlock<number>> => {
      try {
        const {count, error} = await client.from('reviews').select('id', {count: 'exact', head: true})
          .eq('moderation_status', 'pending').is('deleted_at', null).abortSignal(signal);
        if (error) {
          if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code)) return unavailable('评价审核尚未启用，需配套发布评价版本与数据库迁移。');
          throw error;
        }
        if (count === null) throw new Error('Count unavailable');
        return {data: count, loaded: count, total: count, incomplete: false, error: null};
      } catch {return unavailable('评价待办读取失败，请刷新重试。');}
    })(),
    readBlock<AuditRow, AuditItem[]>(() => readRows<AuditRow>((from, to) => client
      .from('admin_audit_logs').select('id,actor_id,action,entity_type,entity_id,metadata,created_at', {count: 'exact'})
      .gte('created_at', since).lte('created_at', until).order('created_at', {ascending: false}).order('id')
      .range(from, to).abortSignal(signal), 30), auditItems)
  ]);
  return {range, updatedAt: now, traffic, searches, quality, pendingReviews, activity};
}
