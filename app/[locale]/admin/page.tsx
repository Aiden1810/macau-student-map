'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {isPrimaryTag} from '@/lib/domain/place-types';
import {findTaxonomyTag} from '@/lib/domain/taxonomy';
import {Link} from '@/i18n/navigation';
import {type ShopCategory} from '@/lib/shops/payload';
import {supabase} from '@/lib/supabase';
import SubmissionQueue, {type QueueStats} from '@/components/admin/SubmissionQueue';
import PlacesManager, {type PlaceSummary} from '@/components/admin/PlacesManager';
import AdminNavigation, {type AdminSection} from '@/components/admin/AdminNavigation';
import PlatformDashboard from '@/components/admin/PlatformDashboard';
import UsersManager from '@/components/admin/UsersManager';
import UsageDashboard from '@/components/admin/UsageDashboard';
import PlaceEditor, {adminEditorRequest} from '@/components/admin/PlaceEditor';
import type {AdminPlaceRecord} from '@/lib/admin/place-editor';
import type {QualityFilter} from '@/lib/admin/operations';
import FeedbackInbox, {type FeedbackStats} from '@/components/admin/FeedbackInbox';
import ReviewInbox from '@/components/admin/ReviewInbox';

type ShopStatus = 'draft' | 'published' | 'archived';
type ShopRegion = '澳门半岛' | '氹仔岛' | '路环岛' | '香洲区' | '横琴区' | '其它';

type ShopRow = {
  id: string; name: string; address: string | null; category: ShopCategory;
  status: 'draft' | 'published' | 'archived'; created_at: string | null;
  price_per_person: number | null; region: ShopRegion | null; shop_type: string | null;
};
const ANALYTICS_REGIONS: Record<string, ShopRegion> = {
  'macau-peninsula': '澳门半岛', taipa: '氹仔岛', coloane: '路环岛', hengqin: '横琴区', zhuhai: '香洲区', other: '其它'
};
type AnalyticsRangeKey = '7d' | '30d' | 'custom';
type AnalyticsSortKey = 'favorites' | 'clicks' | 'favorite_rate' | 'shares' | 'complaints' | 'conversion_rate';
type AnalyticsPriceBand = 'all' | '0-50' | '51-100' | '101-200' | '200+';

type TrafficEventRow = {
  created_at: string;
  session_id: string | null;
  path: string | null;
};

type FavoriteEventRow = {
  shop_id: string;
  created_at: string;
};

type ShopActionEventRow = {
  shop_id: string;
  action_type: 'locate_click' | 'share_click' | 'complaint_submit';
  source: string | null;
  created_at: string;
};

type CommentMetricRow = {
  shop_id: string;
  rating: number;
  created_at: string;
};

type AdminAuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_shop_id: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type MissedQueryRow = {
  query: string;
  normalized_query: string;
  miss_count: number;
  latest_at: string;
  matched_levels: Record<string, number>;
};

type MissedQueryOpsResponse = {
  window: string;
  since: string;
  summary: {
    total_count: number;
    hit_count: number;
    miss_count: number;
    hit_rate: number;
  };
  top_missed_queries: MissedQueryRow[];
  latest_events: Array<{
    query: string;
    normalized_query: string;
    hit: boolean;
    matched_level: string;
    result_count: number;
    searched_at: string;
  }>;
  sql_templates: {
    weekly_top_miss: string;
    weekly_level_breakdown: string;
  };
};

function shortenUuid(uuid: string): string {
  const trimmed = uuid.trim();
  if (!trimmed) return '-';
  return trimmed.length <= 8 ? trimmed : `${trimmed.slice(0, 8)}...`;
}

function readAuditShopName(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.shop_name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const CATEGORY_OPTIONS: Array<{value: ShopCategory; label: string}> = [
  {value: 'food', label: '美食'},
  {value: 'service', label: '生活服务'},
  {value: 'entertainment', label: '娱乐'},
  {value: 'shopping', label: '购物'},
];

const REGION_OPTIONS: ShopRegion[] = ['澳门半岛', '氹仔岛', '路环岛', '香洲区', '横琴区', '其它'];

function inTimeRange(ts: string, startMs: number, endMs: number): boolean {
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) && ms >= startMs && ms < endMs;
}

function getPriceBand(price: number | null): AnalyticsPriceBand {
  if (price === null || !Number.isFinite(price)) return 'all';
  if (price <= 50) return '0-50';
  if (price <= 100) return '51-100';
  if (price <= 200) return '101-200';
  return '200+';
}

export default function AdminModerationPage() {
  const metricsRequestRef = useRef(0);
  const [section, setSection] = useState<AdminSection>('overview');
  const [placeSummary, setPlaceSummary] = useState<PlaceSummary | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [qualityFocusKey, setQualityFocusKey] = useState(0);
  const [dashboardPlaceId, setDashboardPlaceId] = useState<string | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState(0);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [placeRefreshSignal, setPlaceRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [trafficEvents, setTrafficEvents] = useState<TrafficEventRow[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEventRow[]>([]);
  const [shopActionEvents, setShopActionEvents] = useState<ShopActionEventRow[]>([]);
  const [commentMetrics, setCommentMetrics] = useState<CommentMetricRow[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeKey>('7d');
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState<string>('');
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState<string>('');
  const [analyticsSort, setAnalyticsSort] = useState<AnalyticsSortKey>('favorites');
  const [analyticsRegion, setAnalyticsRegion] = useState<ShopRegion | 'all'>('all');
  const [analyticsCategory, setAnalyticsCategory] = useState<ShopCategory | 'all'>('all');
  const [analyticsPriceBand, setAnalyticsPriceBand] = useState<AnalyticsPriceBand>('all');
  const [analyticsOnlyNew, setAnalyticsOnlyNew] = useState(false);
  const [analyticsStatus, setAnalyticsStatus] = useState<ShopStatus | 'all'>('published');
  const [selectedAnalyticsShopId, setSelectedAnalyticsShopId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [missedQueryWindow, setMissedQueryWindow] = useState<'24h' | '7d' | '30d'>('7d');
  const [missedQueryLoading, setMissedQueryLoading] = useState(false);
  const [missedQueryData, setMissedQueryData] = useState<MissedQueryOpsResponse | null>(null);
  const [missedQueryError, setMissedQueryError] = useState<string | null>(null);

  const fetchAllShops = useCallback(async (opts?: {silent?: boolean}) => {
    const requestId = ++metricsRequestRef.current;
    const silent = opts?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [placesResult, trafficRes, favoritesRes, actionsRes, commentsMetricRes] = await Promise.all([
        adminEditorRequest<{items: AdminPlaceRecord[]}>('/api/admin/places', {cache: 'no-store'}),
        supabase
          .from('site_traffic_events')
          .select('created_at,session_id,path', {count: 'exact'})
          .eq('event_type', 'page_view')
          .order('created_at', {ascending: false})
          .limit(20000),
        supabase
          .from('favorites')
          .select('shop_id,created_at')
          .order('created_at', {ascending: false})
          .limit(20000),
        supabase
          .from('shop_action_events')
          .select('shop_id,action_type,source,created_at')
          .order('created_at', {ascending: false})
          .limit(40000),
        supabase
          .from('reviews')
          .select('place_id,rating,created_at').eq('status', 'published').is('deleted_at', null)
          .order('created_at', {ascending: false})
          .limit(40000)
      ]);
      if (requestId !== metricsRequestRef.current) return;

      const unavailableMetrics = [trafficRes.error && '浏览', favoritesRes.error && '收藏', actionsRes.error && '操作', commentsMetricRes.error && '评价'].filter(Boolean);
      setTrafficError(unavailableMetrics.length ? `${unavailableMetrics.join('、')}统计读取失败，请刷新重试。` : null);
      if (trafficRes.error) {
        console.warn('Failed to fetch traffic metrics:', trafficRes.error.message);
        setTrafficEvents([]);
      } else {
        setTrafficEvents((trafficRes.data ?? []) as TrafficEventRow[]);
      }
      setMetricsUpdatedAt(Date.now());

      if (favoritesRes.error) {
        console.warn('Failed to fetch favorite metrics:', favoritesRes.error.message);
        setFavoriteEvents([]);
      } else {
        setFavoriteEvents(
          ((favoritesRes.data ?? []) as Array<{shop_id: string | null; created_at: string}> )
            .filter((row) => Boolean(row.shop_id))
            .map((row) => ({shop_id: String(row.shop_id), created_at: row.created_at}))
        );
      }

      if (actionsRes.error) {
        console.warn('Failed to fetch shop action metrics:', actionsRes.error.message);
        setShopActionEvents([]);
      } else {
        setShopActionEvents(
          ((actionsRes.data ?? []) as Array<{shop_id: string | null; action_type: 'locate_click' | 'share_click' | 'complaint_submit'; source: string | null; created_at: string}>)
            .filter((row) => Boolean(row.shop_id))
            .map((row) => ({
              shop_id: String(row.shop_id),
              action_type: row.action_type,
              source: row.source,
              created_at: row.created_at
            }))
        );
      }

      if (commentsMetricRes.error) {
        console.warn('Failed to fetch comment metrics:', commentsMetricRes.error.message);
        setCommentMetrics([]);
      } else {
        setCommentMetrics(
          ((commentsMetricRes.data ?? []) as Array<{place_id: string | null; rating: number | null; created_at: string}>)
            .filter((row) => Boolean(row.place_id))
            .map((row) => ({shop_id: String(row.place_id), rating: Number(row.rating ?? 0), created_at: row.created_at}))
        );
      }

      setShops(placesResult.items.map(place => ({
        id: place.id, name: place.name, address: place.address, category: place.categorySlug,
        status: place.status, created_at: place.createdAt ?? null, price_per_person: place.pricePerPerson,
        region: place.region ? ANALYTICS_REGIONS[place.region] : null,
        shop_type: place.tagIds.map(findTaxonomyTag).find(tag => tag && isPrimaryTag(tag))?.labelZhMO ?? null
      })));
    } catch {
      if (requestId !== metricsRequestRef.current) return;
      setError('数据读取失败，请检查网络后重试。');
      setTrafficError('数据读取失败');
    } finally {
      if (requestId === metricsRequestRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  const checkAdminRole = useCallback(async () => {
    const {data: authData, error: authError} = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const {data: profile, error: roleError} = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
    if (roleError || profile?.role !== 'admin') {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const {data: latestLogs, error: logsError} = await supabase
      .from('admin_audit_logs')
      .select('id,actor_user_id,action,target_shop_id,note,metadata,created_at')
      .order('created_at', {ascending: false})
      .limit(8);

    if (!logsError) {
      setAuditLogs((latestLogs ?? []) as AdminAuditLogRow[]);
    }

    setIsAdmin(true);
    await fetchAllShops();
  }, [fetchAllShops]);

  useEffect(() => {
    checkAdminRole();
  }, [checkAdminRole]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchMissedQueries = async () => {
      setMissedQueryLoading(true);
      setMissedQueryError(null);

      try {
        const {
          data: {session}
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('管理员登录状态已失效，请重新登录');
        }

        const res = await fetch(`/api/admin/missed-query-ops?window=${missedQueryWindow}&limit=20`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        const data = (await res.json()) as MissedQueryOpsResponse & {error?: string};
        if (!res.ok) {
          throw new Error(data.error ?? '加载未命中词看板失败');
        }
        setMissedQueryData(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载未命中词看板失败';
        setMissedQueryError(message);
        setMissedQueryData(null);
      } finally {
        setMissedQueryLoading(false);
      }
    };

    fetchMissedQueries();
  }, [isAdmin, missedQueryWindow]);

  const shopNameById = useMemo(() => {
    const map = new Map<string, string>();
    shops.forEach((shop) => {
      const id = shop.id?.trim();
      const name = shop.name?.trim();
      if (id && name) map.set(id, name);
    });
    return map;
  }, [shops]);

  const analyticsRangeWindow = useMemo(() => {
    const now = Date.now();
    if (analyticsRange === '7d') return {startMs: now - 7 * 24 * 60 * 60 * 1000, endMs: now};
    if (analyticsRange === '30d') return {startMs: now - 30 * 24 * 60 * 60 * 1000, endMs: now};

    const startMs = analyticsCustomStart ? new Date(`${analyticsCustomStart}T00:00:00`).getTime() : now - 7 * 24 * 60 * 60 * 1000;
    const endMs = analyticsCustomEnd ? new Date(`${analyticsCustomEnd}T23:59:59`).getTime() : now;

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      return {startMs: now - 7 * 24 * 60 * 60 * 1000, endMs: now};
    }

    return {startMs, endMs};
  }, [analyticsCustomEnd, analyticsCustomStart, analyticsRange]);

  const analyticsRows = useMemo(() => {
    if (trafficError) return [];
    const {startMs, endMs} = analyticsRangeWindow;
    const prevStartMs = startMs - (endMs - startMs);
    const prevEndMs = startMs;

    const clicksByShop = new Map<string, number>();
    const prevClicksByShop = new Map<string, number>();
    const favoritesByShop = new Map<string, number>();
    const prevFavoritesByShop = new Map<string, number>();
    const sharesByShop = new Map<string, number>();
    const complaintsByShop = new Map<string, number>();
    const conversionsByShop = new Map<string, number>();
    const commentsByShop = new Map<string, number>();

    trafficEvents.forEach((event) => {
      const match = (event.path ?? '').match(/\/shop\/([^/?#]+)/);
      if (!match?.[1]) return;
      const shopId = match[1];
      if (inTimeRange(event.created_at, startMs, endMs)) {
        clicksByShop.set(shopId, (clicksByShop.get(shopId) ?? 0) + 1);
      } else if (inTimeRange(event.created_at, prevStartMs, prevEndMs)) {
        prevClicksByShop.set(shopId, (prevClicksByShop.get(shopId) ?? 0) + 1);
      }
    });

    favoriteEvents.forEach((event) => {
      if (inTimeRange(event.created_at, startMs, endMs)) {
        favoritesByShop.set(event.shop_id, (favoritesByShop.get(event.shop_id) ?? 0) + 1);
      } else if (inTimeRange(event.created_at, prevStartMs, prevEndMs)) {
        prevFavoritesByShop.set(event.shop_id, (prevFavoritesByShop.get(event.shop_id) ?? 0) + 1);
      }
    });

    shopActionEvents.forEach((event) => {
      if (!inTimeRange(event.created_at, startMs, endMs)) return;
      if (event.action_type === 'share_click') {
        sharesByShop.set(event.shop_id, (sharesByShop.get(event.shop_id) ?? 0) + 1);
      }
      if (event.action_type === 'complaint_submit') {
        complaintsByShop.set(event.shop_id, (complaintsByShop.get(event.shop_id) ?? 0) + 1);
      }
      if (event.action_type === 'locate_click') {
        conversionsByShop.set(event.shop_id, (conversionsByShop.get(event.shop_id) ?? 0) + 1);
      }
    });

    commentMetrics.forEach((event) => {
      if (!inTimeRange(event.created_at, startMs, endMs)) return;
      if (event.rating > 0 && event.rating <= 2) {
        commentsByShop.set(event.shop_id, (commentsByShop.get(event.shop_id) ?? 0) + 1);
      }
    });

    const rows = shops
      .filter((shop) => {
        if (analyticsStatus !== 'all') {
          const s = shop.status ?? 'draft';
          if (s !== analyticsStatus) return false;
        }
        if (analyticsRegion !== 'all' && shop.region !== analyticsRegion) return false;
        if (analyticsCategory !== 'all' && shop.category !== analyticsCategory) return false;
        if (analyticsOnlyNew) {
          const created = shop.created_at ? new Date(shop.created_at).getTime() : 0;
          if (!Number.isFinite(created) || Date.now() - created > 30 * 24 * 60 * 60 * 1000) return false;
        }
        if (analyticsPriceBand !== 'all' && getPriceBand(shop.price_per_person) !== analyticsPriceBand) return false;
        return true;
      })
      .map((shop) => {
        const clicks = clicksByShop.get(shop.id) ?? 0;
        const favorites = favoritesByShop.get(shop.id) ?? 0;
        const prevFavorites = prevFavoritesByShop.get(shop.id) ?? 0;
        const shares = sharesByShop.get(shop.id) ?? 0;
        const complaints = (complaintsByShop.get(shop.id) ?? 0) + (commentsByShop.get(shop.id) ?? 0);
        const conversions = conversionsByShop.get(shop.id) ?? 0;
        const favoriteRate = clicks > 0 ? favorites / clicks : 0;
        const conversionRate = clicks > 0 ? conversions / clicks : 0;
        const favoriteGrowth = prevFavorites > 0 ? (favorites - prevFavorites) / prevFavorites : favorites > 0 ? 1 : 0;
        const prevClicks = prevClicksByShop.get(shop.id) ?? 0;
        const clickGrowth = prevClicks > 0 ? (clicks - prevClicks) / prevClicks : clicks > 0 ? 1 : 0;

        const trendFlag = favoriteGrowth > 0.5 ? '爆发' : favoriteGrowth < -0.3 ? '下滑' : null;

        return {
          shop,
          clicks,
          favorites,
          shares,
          complaints,
          conversions,
          favoriteRate,
          conversionRate,
          favoriteGrowth,
          clickGrowth,
          trendFlag
        };
      })
      .sort((a, b) => {
        if (analyticsSort === 'favorites') return b.favorites - a.favorites;
        if (analyticsSort === 'clicks') return b.clicks - a.clicks;
        if (analyticsSort === 'favorite_rate') return b.favoriteRate - a.favoriteRate;
        if (analyticsSort === 'shares') return b.shares - a.shares;
        if (analyticsSort === 'complaints') return b.complaints - a.complaints;
        return b.conversionRate - a.conversionRate;
      });

    return rows;
  }, [analyticsCategory, analyticsOnlyNew, analyticsPriceBand, analyticsRangeWindow, analyticsRegion, analyticsSort, analyticsStatus, commentMetrics, favoriteEvents, shopActionEvents, shops, trafficEvents, trafficError]);

  const selectedAnalyticsShop = useMemo(() => {
    if (!selectedAnalyticsShopId) return analyticsRows[0] ?? null;
    return analyticsRows.find((item) => item.shop.id === selectedAnalyticsShopId) ?? analyticsRows[0] ?? null;
  }, [analyticsRows, selectedAnalyticsShopId]);

  const selectedShopSourceBreakdown = useMemo(() => {
    if (!selectedAnalyticsShop) return [] as Array<{source: string; count: number}>;

    const {startMs, endMs} = analyticsRangeWindow;
    const map = new Map<string, number>();

    shopActionEvents.forEach((event) => {
      if (event.shop_id !== selectedAnalyticsShop.shop.id) return;
      if (!inTimeRange(event.created_at, startMs, endMs)) return;
      const key = event.source?.trim() || 'unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([source, count]) => ({source, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [analyticsRangeWindow, selectedAnalyticsShop, shopActionEvents]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">加载管理员数据中...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">无访问权限</h1>
          <p className="mt-2 text-sm text-slate-600">请使用管理员账号登录后再访问后台。</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/admin-login" className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white">前往登录</Link>
            <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">返回首页</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation section={section} onChange={setSection} onCreate={() => {setSection('places'); setShowCreateModal(true);}} />
        <PlatformDashboard section={section} places={placeSummary} queue={queueStats} feedback={feedbackStats} onChange={setSection}
          onQuality={filter => {setQualityFilter(filter); setQualityFocusKey(value => value + 1); setSection('places');}} onEditPlace={setDashboardPlaceId} refreshSignal={placeRefreshSignal} />
        <div hidden={section !== 'places'}><PlacesManager createOpen={showCreateModal} onCreateClose={() => setShowCreateModal(false)} refreshSignal={placeRefreshSignal} onSummaryChange={setPlaceSummary}
          qualityFilter={qualityFilter} onQualityFilterChange={setQualityFilter} qualityFocusKey={qualityFocusKey} /></div>
        <div hidden={section !== 'submissions'}><SubmissionQueue onPublished={() => setPlaceRefreshSignal(value => value + 1)} onStatsChange={setQueueStats} /></div>
        <div hidden={section !== 'feedback'}><FeedbackInbox onStatsChange={setFeedbackStats} /></div>
        {section==='reviews'&&<ReviewInbox/>}
        {section==='users'&&<UsersManager/>}
        {section==='usage'&&<UsageDashboard/>}
        <div hidden={section !== 'tools'}>
          <div className="mb-5 rounded-2xl border border-line bg-white p-5"><h2 className="text-lg font-semibold text-ink">更多工具</h2><p className="mt-1 text-sm text-muted">地点使用统计、搜索分析和操作记录集中在这里，按需展开查看。</p>
            {metricsUpdatedAt > 0 && <p className="mt-2 text-xs text-muted">更新于 {new Date(metricsUpdatedAt).toLocaleString()}</p>}
            {trafficError && <p role="alert" className="mt-2 text-sm text-rose-700">{trafficError}</p>}
            <button type="button" onClick={() => void fetchAllShops({silent: true})} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm">{refreshing ? '刷新中...' : '刷新统计'}</button>
          </div>
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer py-1 font-medium text-slate-700">地点使用统计（{shops.length} 条店铺）</summary>
          <div className="mt-4">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div>
              <p className="font-semibold">请求失败</p>
              <p className="mt-1">{error}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => fetchAllShops({silent: true})}
                className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700"
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">店铺数据榜单（核心）</h2>
              <p className="mt-1 text-xs text-slate-500">支持 7天 / 30天 / 自定义，默认按新增收藏数降序</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAnalyticsRange('7d')} className={`rounded-full px-3 py-1 text-xs font-semibold ${analyticsRange === '7d' ? 'bg-[#006633] text-white' : 'bg-slate-100 text-slate-600'}`}>近7天</button>
              <button type="button" onClick={() => setAnalyticsRange('30d')} className={`rounded-full px-3 py-1 text-xs font-semibold ${analyticsRange === '30d' ? 'bg-[#006633] text-white' : 'bg-slate-100 text-slate-600'}`}>近30天</button>
              <button type="button" onClick={() => setAnalyticsRange('custom')} className={`rounded-full px-3 py-1 text-xs font-semibold ${analyticsRange === 'custom' ? 'bg-[#006633] text-white' : 'bg-slate-100 text-slate-600'}`}>自定义</button>
            </div>
          </div>

          {analyticsRange === 'custom' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <input type="date" value={analyticsCustomStart} onChange={(e) => setAnalyticsCustomStart(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" />
              <span className="text-slate-400">至</span>
              <input type="date" value={analyticsCustomEnd} onChange={(e) => setAnalyticsCustomEnd(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" />
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select value={analyticsSort} onChange={(e) => setAnalyticsSort(e.target.value as AnalyticsSortKey)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="favorites">按收藏数</option>
              <option value="clicks">按点击数</option>
              <option value="favorite_rate">按收藏率</option>
              <option value="shares">按分享数</option>
              <option value="complaints">按投诉/差评数</option>
              <option value="conversion_rate">按转化率</option>
            </select>

            <select value={analyticsRegion} onChange={(e) => setAnalyticsRegion(e.target.value as ShopRegion | 'all')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="all">全部区域</option>
              {REGION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={analyticsCategory} onChange={(e) => setAnalyticsCategory(e.target.value as ShopCategory | 'all')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="all">全部品类</option>
              {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            <select value={analyticsPriceBand} onChange={(e) => setAnalyticsPriceBand(e.target.value as AnalyticsPriceBand)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="all">全部价格带</option>
              <option value="0-50">0-50</option>
              <option value="51-100">51-100</option>
              <option value="101-200">101-200</option>
              <option value="200+">200+</option>
            </select>

            <select value={analyticsStatus} onChange={(e) => setAnalyticsStatus(e.target.value as ShopStatus | 'all')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="all">全部状态</option>
              <option value="published">已上线</option>
              <option value="draft">草稿</option>
              <option value="archived">已下架</option>
            </select>

            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              <input type="checkbox" checked={analyticsOnlyNew} onChange={(e) => setAnalyticsOnlyNew(e.target.checked)} /> 仅看新上线(30天)
            </label>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">店铺</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">收藏</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">点击</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">收藏率</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">分享</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">投诉</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">转化率</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">趋势</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {analyticsRows.slice(0, 30).map((row) => (
                  <tr key={row.shop.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedAnalyticsShopId(row.shop.id)}>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.shop.name}</td>
                    <td className="px-3 py-2">{row.favorites}</td>
                    <td className="px-3 py-2">{row.clicks}</td>
                    <td className="px-3 py-2">{(row.favoriteRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{row.shares}</td>
                    <td className="px-3 py-2">{row.complaints}</td>
                    <td className="px-3 py-2">{(row.conversionRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      {row.trendFlag ? (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${row.trendFlag === '爆发' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{row.trendFlag}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedAnalyticsShop && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">店铺下钻：{selectedAnalyticsShop.shop.name}</h3>
              <p className="mt-1 text-xs text-slate-600">{selectedAnalyticsShop.shop.category ?? '-'} · {selectedAnalyticsShop.shop.shop_type ?? '-'} · 上架时间 {selectedAnalyticsShop.shop.created_at ? new Date(selectedAnalyticsShop.shop.created_at).toLocaleDateString() : '-'}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">点击：<span className="font-semibold">{selectedAnalyticsShop.clicks}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">收藏：<span className="font-semibold">{selectedAnalyticsShop.favorites}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">收藏率：<span className="font-semibold">{(selectedAnalyticsShop.favoriteRate * 100).toFixed(1)}%</span></div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">投诉/差评：<span className="font-semibold">{selectedAnalyticsShop.complaints}</span></div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-700">流量来源（事件 source Top）</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedShopSourceBreakdown.length === 0 ? <span className="text-xs text-slate-500">暂无来源数据</span> : selectedShopSourceBreakdown.map((item) => (
                    <span key={item.source} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">{item.source}: {item.count}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>



        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">未命中高频词运营看板</h2>
              <p className="mt-1 text-xs text-slate-500">自动统计搜索未命中词，并提供周度入库的审查入口</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                {key: '24h', label: '24h'},
                {key: '7d', label: '7d'},
                {key: '30d', label: '30d'}
              ] as Array<{key: '24h' | '7d' | '30d'; label: string}>).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMissedQueryWindow(item.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${missedQueryWindow === item.key ? 'bg-[#006633] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  近{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">总搜索量</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{missedQueryData?.summary.total_count ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">命中率</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{missedQueryData ? `${(missedQueryData.summary.hit_rate * 100).toFixed(1)}%` : '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">未命中次数</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{missedQueryData?.summary.miss_count ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">TOP 未命中词</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{missedQueryData?.top_missed_queries.length ?? '-'}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {missedQueryLoading ? (
              <div className="bg-slate-50 p-4 text-sm text-slate-500">加载未命中高频词中...</div>
            ) : missedQueryError ? (
              <div className="bg-rose-50 p-4 text-sm text-rose-700">{missedQueryError}</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">词条</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">未命中次数</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">最近出现</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">命中层级分布</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">入库建议</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(missedQueryData?.top_missed_queries ?? []).map((row) => (
                    <tr key={row.normalized_query}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.query}</td>
                      <td className="px-3 py-2">{row.miss_count}</td>
                      <td className="px-3 py-2 text-slate-600">{new Date(row.latest_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600">{Object.entries(row.matched_levels).map(([k, v]) => `${k}:${v}`).join(' · ') || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">建议优先人工确认是否应补到 `tag_synonym` 或 `query_expand_dict`</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {missedQueryData && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">周度 SQL 模板</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700">{missedQueryData.sql_templates.weekly_top_miss}\n\n{missedQueryData.sql_templates.weekly_level_breakdown}</pre>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">最近未命中事件</p>
                <div className="mt-2 space-y-2">
                  {missedQueryData.latest_events.slice(0, 8).map((item, index) => (
                    <div key={`${item.normalized_query}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-900">{item.query}</span> · {item.matched_level} · {item.result_count} 条 · {new Date(item.searched_at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">关键操作审计日志</h2>
            <p className="text-xs text-slate-500">最近 8 条管理员动作</p>
          </div>
          <div className="mt-3 space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">暂无审计日志（请先执行 SQL 初始化 admin_audit_logs 表）</p>
            ) : (
              auditLogs.map((log) => {
                const shopNameFromMetadata = readAuditShopName(log.metadata);
                const shopId = log.target_shop_id?.trim() || null;
                const hasShopId = Boolean(shopId);
                const shopNameFromMap = shopId ? shopNameById.get(shopId) ?? null : null;
                const shopLabel = shopNameFromMetadata ?? shopNameFromMap ?? (hasShopId ? '未知店铺' : '-');
                const shopTooltip = shopId ? `UUID: ${shopId}` : undefined;
                const shortShopId = shopId ? shortenUuid(shopId) : null;

                return (
                  <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="min-w-[220px] text-slate-700">
                      <span className="font-semibold text-slate-900">{log.action}</span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="inline-flex max-w-full items-center gap-1.5 align-middle" title={shopTooltip}>
                        <span className="text-slate-500">shop:</span>
                        <span className="max-w-[180px] truncate font-medium text-slate-800">{shopLabel}</span>
                        {shortShopId ? <span className="text-slate-400">({shortShopId})</span> : null}
                      </span>
                    </div>
                    <div className="text-slate-500">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

          </div>
        </details>
        </div>
      </div>

      {dashboardPlaceId && <PlaceEditor target={{kind: 'place', id: dashboardPlaceId}} onClose={() => setDashboardPlaceId(null)} onSaved={() => setPlaceRefreshSignal(value => value + 1)} />}
    </div>
  );
}
