'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

type ShopStatus = 'pending' | 'verified' | 'rejected';
type ShopCategory = 'food' | 'drink' | 'vibe' | 'deal';
type ShopType = '正餐' | '快餐小吃' | '饮品甜点' | '服务';
type RatingLabel = '封神之作' | '强烈推荐' | '还行吧' | '建议避雷' | '暂无评分';
type Feature = '有折扣' | '学生价' | '深夜营业' | '适合拍照' | '外卖可达';
type ShopRegion = '澳门半岛' | '氹仔岛' | '路环岛' | '香洲区' | '横琴区' | '其它';

type ShopRow = {
  id: string;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
  category: ShopCategory | null;
  tags: string[] | null;
  features: Feature[] | null;
  shop_type: ShopType | null;
  rating_label: RatingLabel | null;
  image_urls: string[] | null;
  review_text: string | null;
  student_discount: string | null;
  status: ShopStatus | null;
  created_at: string | null;
  sub_tags: string[] | null;
  price_per_person: number | null;
  region: ShopRegion | null;
  signature_dish: string | null;
  sharp_review: string | null;
};

type ShopFormValue = {
  name: string;
  address: string;
  longitude: string;
  latitude: string;
  category: ShopCategory;
  shop_type: ShopType;
  rating_label: RatingLabel;
  features: Feature[];
  tags: string[];
  custom_tags: string;
  image_urls: string;
  review_text: string;
  student_discount: string;
  status: ShopStatus;
  price_per_person: string;
  region: ShopRegion | '';
  signature_dish: string;
  sharp_review: string;
};

type BusyActionType = 'approve' | 'reject' | 'delete';
type BusyAction = {shopId: string; action: BusyActionType} | null;

type HealthStats = {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  missingCategory: number;
  missingShopType: number;
  missingRatingLabel: number;
  newShops24h: number;
  newComments24h: number;
};

type TrafficRangeKey = '24h' | '7d' | '30d' | '365d' | 'all';

type TrafficEventRow = {
  created_at: string;
  session_id: string | null;
  path: string | null;
};

const CATEGORY_OPTIONS: Array<{value: ShopCategory; label: string}> = [
  {value: 'food', label: '美食'},
  {value: 'drink', label: '饮品'},
  {value: 'vibe', label: '氛围'},
  {value: 'deal', label: '优惠'}
];

const SHOP_TYPE_OPTIONS: ShopType[] = ['正餐', '快餐小吃', '饮品甜点', '服务'];
const RATING_OPTIONS: RatingLabel[] = ['封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分'];
const FEATURE_OPTIONS: Feature[] = ['有折扣', '学生价', '深夜营业', '适合拍照', '外卖可达'];
const REGION_OPTIONS: ShopRegion[] = ['澳门半岛', '氹仔岛', '路环岛', '香洲区', '横琴区', '其它'];

function toFormValue(shop?: ShopRow | null): ShopFormValue {
  if (!shop) {
    return {
      name: '',
      address: '',
      longitude: '',
      latitude: '',
      category: 'food',
      shop_type: '正餐',
      rating_label: '暂无评分',
      features: [],
      tags: [],
      custom_tags: '',
      image_urls: '',
      review_text: '',
      student_discount: '',
      status: 'verified',
      price_per_person: '',
      region: '',
      signature_dish: '',
      sharp_review: ''
    };
  }

  return {
    name: shop.name ?? '',
    address: shop.address ?? '',
    longitude: shop.longitude?.toString() ?? '',
    latitude: shop.latitude?.toString() ?? '',
    category: shop.category ?? 'food',
    shop_type: shop.shop_type ?? '正餐',
    rating_label: shop.rating_label ?? '暂无评分',
    features: shop.features ?? [],
    tags: shop.tags ?? [],
    custom_tags: '',
    image_urls: (shop.image_urls ?? []).join('\n'),
    review_text: shop.review_text ?? '',
    student_discount: shop.student_discount ?? '',
    status: shop.status ?? 'pending',
    price_per_person: shop.price_per_person?.toString() ?? '',
    region: shop.region ?? '',
    signature_dish: shop.signature_dish ?? '',
    sharp_review: shop.sharp_review ?? ''
  };
}

function parseList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeTrimmedList(list: string[], limit?: number): string[] {
  const normalized = Array.from(new Set(list.map((item) => item.trim()).filter(Boolean)));
  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function isLikelyMacauArea(lng: number, lat: number): boolean {
  return lng >= 113 && lng <= 114.2 && lat >= 21.8 && lat <= 22.6;
}

function AdminShopForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  submitting
}: {
  mode: 'create' | 'edit';
  initial?: ShopRow | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<ShopFormValue>(toFormValue(initial));

  useEffect(() => {
    setForm(toFormValue(initial));
  }, [initial]);

  const toggleFeature = (feature: Feature) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature) ? prev.features.filter((f) => f !== feature) : [...prev.features, feature]
    }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    if (!name) return toast.error('店名不能为空');

    const lng = form.longitude.trim() ? Number(form.longitude.trim()) : null;
    const lat = form.latitude.trim() ? Number(form.latitude.trim()) : null;

    if (form.longitude.trim() && Number.isNaN(lng)) return toast.error('Longitude 必须是数字');
    if (form.latitude.trim() && Number.isNaN(lat)) return toast.error('Latitude 必须是数字');

    const mergedTags = dedupeTrimmedList([...form.tags, ...parseList(form.custom_tags)], 5);
    const imageUrls = dedupeTrimmedList(parseList(form.image_urls));
    const pricePerPerson = parsePrice(form.price_per_person);

    if (form.price_per_person.trim() && pricePerPerson === null) {
      return toast.error('人均消费必须是有效数字');
    }

    if (lng !== null && lat !== null && !isLikelyMacauArea(lng, lat)) {
      return toast.error('经纬度不在澳门/珠海范围内，请确认坐标是否正确');
    }

    const payload: Record<string, unknown> = {
      name,
      address: form.address.trim() || null,
      longitude: lng,
      latitude: lat,
      category: form.category,
      shop_type: form.shop_type,
      rating_label: form.rating_label,
      features: dedupeTrimmedList(form.features),
      tags: mergedTags,
      image_urls: imageUrls,
      review_text: form.review_text.trim() || null,
      student_discount: form.student_discount.trim() || null,
      status: form.status,
      price_per_person: pricePerPerson,
      region: form.region || null,
      signature_dish: form.signature_dish.trim() || null,
      sharp_review: form.sharp_review.trim() || null
    };

    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{mode === 'create' ? '新增店铺（管理员直发）' : '编辑店铺信息'}</h3>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">店名 *</span>
            <input required value={form.name} onChange={(e) => setForm((prev) => ({...prev, name: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">地址</span>
            <input value={form.address} onChange={(e) => setForm((prev) => ({...prev, address: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">主分类</span>
            <select value={form.category} onChange={(e) => setForm((prev) => ({...prev, category: e.target.value as ShopCategory}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]">
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">类型</span>
            <select value={form.shop_type} onChange={(e) => setForm((prev) => ({...prev, shop_type: e.target.value as ShopType}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]">
              {SHOP_TYPE_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Longitude</span>
            <input value={form.longitude} onChange={(e) => setForm((prev) => ({...prev, longitude: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Latitude</span>
            <input value={form.latitude} onChange={(e) => setForm((prev) => ({...prev, latitude: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">口碑标签</p>
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map((label) => (
                <button key={label} type="button" onClick={() => setForm((prev) => ({...prev, rating_label: label}))} className={`rounded-full border px-3 py-1 text-xs font-medium ${form.rating_label === label ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">特色（多选）</p>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((feature) => (
                <button key={feature} type="button" onClick={() => toggleFeature(feature)} className={`rounded-full border px-3 py-1 text-xs font-medium ${form.features.includes(feature) ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {feature}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">标签（最多5个）</p>
            <div className="flex flex-wrap gap-2">
              {['正餐', '快餐小吃', '奶茶', '咖啡', '适合拍照', '手打柠檬茶', '炸鸡', '葡挞'].map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full border px-3 py-1 text-xs font-medium ${form.tags.includes(tag) ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">补充标签（逗号/换行）</span>
            <textarea rows={2} value={form.custom_tags} onChange={(e) => setForm((prev) => ({...prev, custom_tags: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">图片 URL（逗号/换行）</span>
            <textarea rows={3} value={form.image_urls} onChange={(e) => setForm((prev) => ({...prev, image_urls: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">评论摘要</span>
            <textarea rows={3} value={form.review_text} onChange={(e) => setForm((prev) => ({...prev, review_text: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">学生优惠文案</span>
            <input value={form.student_discount} onChange={(e) => setForm((prev) => ({...prev, student_discount: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">人均消费（MOP）</span>
            <input value={form.price_per_person} onChange={(e) => setForm((prev) => ({...prev, price_per_person: e.target.value}))} placeholder="例如 68" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">区域</span>
            <select value={form.region} onChange={(e) => setForm((prev) => ({...prev, region: e.target.value as ShopRegion | ''}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]">
              <option value="">未填写</option>
              {REGION_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">招牌推荐</span>
            <input value={form.signature_dish} onChange={(e) => setForm((prev) => ({...prev, signature_dish: e.target.value}))} placeholder="例如：葡式焗鸡饭" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">一句话锐评</span>
            <textarea rows={2} value={form.sharp_review} onChange={(e) => setForm((prev) => ({...prev, sharp_review: e.target.value}))} placeholder="例如：夜宵档口王者，出餐快且稳定" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">状态</span>
            <select value={form.status} onChange={(e) => setForm((prev) => ({...prev, status: e.target.value as ShopStatus}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]">
              <option value="pending">pending</option>
              <option value="verified">verified</option>
              <option value="rejected">rejected</option>
            </select>
          </label>

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">取消</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {submitting ? '保存中...' : mode === 'create' ? '发布' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminModerationPage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [newComments24h, setNewComments24h] = useState(0);
  const [trafficEvents, setTrafficEvents] = useState<TrafficEventRow[]>([]);
  const [trafficRange, setTrafficRange] = useState<TrafficRangeKey>('24h');
  const [backfilling, setBackfilling] = useState(false);

  const fetchAllShops = useCallback(async (opts?: {silent?: boolean}) => {
    const silent = opts?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const since24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const shopsRes = await supabase
      .from('shops')
      .select('id,name,address,longitude,latitude,category,tags,features,shop_type,rating_label,image_urls,review_text,student_discount,status,created_at,sub_tags,price_per_person,region,signature_dish,sharp_review')
      .or('status.in.(pending,verified,rejected),status.is.null')
      .order('created_at', {ascending: false});

    const primaryCommentsRes = await supabase.from('shop_comments').select('id', {count: 'exact', head: true}).gte('created_at', since24hIso);
    const commentsRes =
      primaryCommentsRes.error
        ? await supabase.from('comments').select('id', {count: 'exact', head: true}).gte('created_at', since24hIso)
        : primaryCommentsRes;

    const trafficRes = await supabase
      .from('site_traffic_events')
      .select('created_at,session_id,path')
      .eq('event_type', 'page_view')
      .order('created_at', {ascending: false})
      .limit(20000);

    if (shopsRes.error) {
      setError(shopsRes.error.message);
      setShops([]);
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      return;
    }

    if (commentsRes.error) {
      console.warn('Failed to fetch comment health metrics:', commentsRes.error.message);
      setNewComments24h(0);
    } else {
      setNewComments24h(commentsRes.count ?? 0);
    }

    if (trafficRes.error) {
      console.warn('Failed to fetch traffic metrics:', trafficRes.error.message);
      setTrafficEvents([]);
    } else {
      setTrafficEvents((trafficRes.data ?? []) as TrafficEventRow[]);
    }

    setShops((shopsRes.data ?? []).map((row) => ({...row, id: String(row.id)})) as ShopRow[]);
    if (silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
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

    setIsAdmin(true);
    await fetchAllShops();
  }, [fetchAllShops]);

  useEffect(() => {
    checkAdminRole();
  }, [checkAdminRole]);

  const pendingCount = useMemo(() => shops.filter((item) => item.status === 'pending' || item.status === null).length, [shops]);
  const verifiedCount = useMemo(() => shops.filter((item) => item.status === 'verified').length, [shops]);
  const rejectedCount = useMemo(() => shops.filter((item) => item.status === 'rejected').length, [shops]);

  const healthStats = useMemo<HealthStats>(() => {
    const total = shops.length;
    const pending = shops.filter((item) => item.status === 'pending' || item.status === null).length;
    const verified = shops.filter((item) => item.status === 'verified').length;
    const rejected = shops.filter((item) => item.status === 'rejected').length;

    const missingCategory = shops.filter((item) => !item.category).length;
    const missingShopType = shops.filter((item) => !item.shop_type).length;
    const missingRatingLabel = shops.filter((item) => !item.rating_label).length;

    const nowMs = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const newShops24h = shops.filter((item) => {
      if (!item.created_at) return false;
      const created = new Date(item.created_at).getTime();
      return Number.isFinite(created) && nowMs - created <= windowMs;
    }).length;

    return {
      total,
      pending,
      verified,
      rejected,
      missingCategory,
      missingShopType,
      missingRatingLabel,
      newShops24h,
      newComments24h
    };
  }, [newComments24h, shops]);

  const visibleShops = useMemo(() => {
    if (statusTab === 'pending') {
      return shops.filter((shop) => shop.status === 'pending' || shop.status === null);
    }
    if (statusTab === 'verified') {
      return shops.filter((shop) => shop.status === 'verified');
    }
    return shops.filter((shop) => shop.status === 'rejected');
  }, [shops, statusTab]);

  const trafficWindowStart = useMemo(() => {
    const now = Date.now();
    if (trafficRange === '24h') return now - 24 * 60 * 60 * 1000;
    if (trafficRange === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (trafficRange === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    if (trafficRange === '365d') return now - 365 * 24 * 60 * 60 * 1000;
    return 0;
  }, [trafficRange]);

  const filteredTrafficEvents = useMemo(() => {
    return trafficEvents.filter((event) => {
      const ts = new Date(event.created_at).getTime();
      return Number.isFinite(ts) && ts >= trafficWindowStart;
    });
  }, [trafficEvents, trafficWindowStart]);

  const trafficSummary = useMemo(() => {
    const pv = filteredTrafficEvents.length;
    const uv = new Set(filteredTrafficEvents.map((event) => event.session_id).filter(Boolean)).size;

    const bucketMap = new Map<string, number>();
    const pathMap = new Map<string, number>();

    for (const event of filteredTrafficEvents) {
      const ts = new Date(event.created_at);
      if (!Number.isFinite(ts.getTime())) continue;

      const bucketLabel =
        trafficRange === '24h'
          ? `${String(ts.getHours()).padStart(2, '0')}:00`
          : trafficRange === '7d' || trafficRange === '30d'
            ? `${ts.getMonth() + 1}/${ts.getDate()}`
            : `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;

      bucketMap.set(bucketLabel, (bucketMap.get(bucketLabel) ?? 0) + 1);

      const path = (event.path || '/').trim() || '/';
      pathMap.set(path, (pathMap.get(path) ?? 0) + 1);
    }

    const timeline = Array.from(bucketMap.entries())
      .map(([label, count]) => ({label, count}))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-24);

    const topPages = Array.from(pathMap.entries())
      .map(([path, count]) => ({path, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const peakPoint = timeline.reduce<{label: string; count: number} | null>((max, item) => {
      if (!max || item.count > max.count) return item;
      return max;
    }, null);

    return {pv, uv, timeline, topPages, peakPoint};
  }, [filteredTrafficEvents, trafficRange]);

  const updateStatus = async (shopId: string, nextStatus: ShopStatus, action: BusyActionType) => {
    if (!isAdmin || busyAction) return;
    setBusyAction({shopId, action});
    const {error: updateError} = await supabase.from('shops').update({status: nextStatus}).eq('id', shopId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`操作失败：${updateError.message}`);
      setBusyAction(null);
      return;
    }
    toast.success(nextStatus === 'verified' ? '店铺已通过并上线' : '店铺已驳回');
    await fetchAllShops();
    setBusyAction(null);
  };

  const hardDelete = async (shopId: string) => {
    if (!isAdmin || busyAction) return;
    if (!window.confirm('确定永久删除这家店铺吗？此操作不可恢复。')) return;

    setBusyAction({shopId, action: 'delete'});
    const {error: deleteError} = await supabase.from('shops').delete().eq('id', shopId);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`删除失败：${deleteError.message}`);
      setBusyAction(null);
      return;
    }

    toast.success('店铺已永久删除');
    await fetchAllShops();
    setBusyAction(null);
  };

  const handleCreate = async (payload: Record<string, unknown>) => {
    setSaving(true);
    const {error: insertError} = await supabase.from('shops').insert(payload);
    if (insertError) {
      setError(insertError.message);
      toast.error(`新增失败：${insertError.message}`);
      setSaving(false);
      return;
    }

    toast.success('店铺已新增并上线');
    setShowCreateModal(false);
    setSaving(false);
    await fetchAllShops();
  };

  const handleEdit = async (payload: Record<string, unknown>) => {
    if (!editingShop) return;
    setSaving(true);

    const {error: updateError} = await supabase.from('shops').update(payload).eq('id', editingShop.id);
    if (updateError) {
      setError(updateError.message);
      toast.error(`保存失败：${updateError.message}`);
      setSaving(false);
      return;
    }

    toast.success('店铺信息已更新');
    setEditingShop(null);
    setSaving(false);
    await fetchAllShops();
  };

  const handleBackfillMissingFields = async () => {
    if (backfilling) return;

    const confirmed = window.confirm('将批量补全缺失的 category / shop_type / rating_label，确定继续吗？');
    if (!confirmed) return;

    setBackfilling(true);
    setError(null);

    const updates = shops
      .filter((shop) => !shop.category || !shop.shop_type || !shop.rating_label)
      .map((shop) => ({
        id: shop.id,
        category: shop.category ?? 'food',
        shop_type: shop.shop_type ?? '服务',
        rating_label: shop.rating_label ?? '暂无评分'
      }));

    if (updates.length === 0) {
      toast.success('没有需要补全的店铺');
      setBackfilling(false);
      return;
    }

    const {error: upsertError} = await supabase.from('shops').upsert(updates, {onConflict: 'id'});

    if (upsertError) {
      setError(upsertError.message);
      toast.error(`批量补全失败：${upsertError.message}`);
      setBackfilling(false);
      return;
    }

    toast.success(`已补全 ${updates.length} 家店铺的缺失字段`);
    setBackfilling(false);
    await fetchAllShops({silent: true});
  };

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
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#006633]">Admin CMS</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">店铺管理后台</h1>
              <p className="mt-1 text-sm text-slate-600">后台字段与前台筛选字段完全统一。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setStatusTab('pending')} className={`rounded-full px-3 py-1 text-sm font-semibold ${statusTab === 'pending' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-600'}`}>待审核：{pendingCount}</button>
              <button type="button" onClick={() => setStatusTab('verified')} className={`rounded-full px-3 py-1 text-sm font-semibold ${statusTab === 'verified' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>已审核通过：{verifiedCount}</button>
              <button type="button" onClick={() => setStatusTab('rejected')} className={`rounded-full px-3 py-1 text-sm font-semibold ${statusTab === 'rejected' ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' : 'bg-slate-100 text-slate-600'}`}>已驳回：{rejectedCount}</button>
              <button type="button" onClick={() => fetchAllShops({silent: true})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">{refreshing ? '刷新中...' : '刷新列表'}</button>
              <button type="button" onClick={handleBackfillMissingFields} disabled={backfilling} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60">{backfilling ? '补全中...' : '补全缺失字段'}</button>
              <button type="button" onClick={() => setShowCreateModal(true)} className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white">新增店铺</button>
              <Link href="/" className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">返回首页</Link>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">店铺总数</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{healthStats.total}</p>
            <p className="mt-1 text-xs text-slate-500">pending {healthStats.pending} / verified {healthStats.verified} / rejected {healthStats.rejected}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">最近 24 小时</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">+{healthStats.newShops24h}</p>
            <p className="mt-1 text-xs text-slate-500">新增店铺，新增评论 {healthStats.newComments24h} 条</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">字段缺失（分类）</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{healthStats.missingCategory}</p>
            <p className="mt-1 text-xs text-slate-500">category 为空的店铺数</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">字段缺失（类型/口碑）</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{healthStats.missingShopType + healthStats.missingRatingLabel}</p>
            <p className="mt-1 text-xs text-slate-500">shop_type {healthStats.missingShopType}，rating_label {healthStats.missingRatingLabel}</p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">网站流量分析面板</h2>
              <p className="mt-1 text-xs text-slate-500">支持 24 小时 / 7 天 / 30 天 / 365 天 / 成立以来 的流量分析</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                {key: '24h', label: '24h'},
                {key: '7d', label: '一周'},
                {key: '30d', label: '一个月'},
                {key: '365d', label: '一年'},
                {key: 'all', label: '成立以来'}
              ] as Array<{key: TrafficRangeKey; label: string}>).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTrafficRange(item.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    trafficRange === item.key
                      ? 'bg-[#006633] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">PV（页面浏览）</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{trafficSummary.pv}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">UV（独立会话）</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{trafficSummary.uv}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">平均每会话浏览</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{trafficSummary.uv > 0 ? (trafficSummary.pv / trafficSummary.uv).toFixed(2) : '0.00'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">流量峰值</p>
              <p className="mt-1 text-base font-bold text-slate-900">{trafficSummary.peakPoint ? `${trafficSummary.peakPoint.label} (${trafficSummary.peakPoint.count})` : '-'}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">时间点趋势（最近 24 个桶）</p>
              <div className="space-y-2">
                {trafficSummary.timeline.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无流量数据</p>
                ) : (
                  trafficSummary.timeline.map((item) => {
                    const max = Math.max(...trafficSummary.timeline.map((x) => x.count), 1);
                    const widthPct = Math.max(6, Math.round((item.count / max) * 100));
                    return (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-slate-500">{item.label}</span>
                        <div className="h-2 flex-1 rounded bg-slate-100">
                          <div className="h-2 rounded bg-[#006633]" style={{width: `${widthPct}%`}} />
                        </div>
                        <span className="w-8 shrink-0 text-right font-semibold text-slate-700">{item.count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">Top 页面（PV）</p>
              <div className="space-y-2">
                {trafficSummary.topPages.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无页面数据</p>
                ) : (
                  trafficSummary.topPages.map((item, index) => (
                    <div key={`${item.path}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span className="truncate text-slate-700">{item.path}</span>
                      <span className="ml-2 font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {healthStats.total === 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
            当前数据库暂无店铺，这属于正常空库阶段。你可以点击右上角“新增店铺”先录入基础样本，再做前台回归测试。
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visibleShops.map((shop) => {
            const isApproving = busyAction?.shopId === shop.id && busyAction.action === 'approve';
            const isRejecting = busyAction?.shopId === shop.id && busyAction.action === 'reject';
            const isDeleting = busyAction?.shopId === shop.id && busyAction.action === 'delete';
            const isBusy = busyAction?.shopId === shop.id;

            return (
              <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="truncate text-lg font-bold text-slate-900">{shop.name || '未命名店铺'}</h2>
                <p className="mt-1 text-xs text-slate-500">{shop.address || '暂无地址'}</p>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>频道分类：<span className="font-medium text-slate-800">{shop.category ?? '-'}</span></p>
                  <p>类型：<span className="font-medium text-slate-800">{shop.shop_type ?? '-'}</span></p>
                  <p>口碑：<span className="font-medium text-slate-800">{shop.rating_label ?? '-'}</span></p>
                  <p>特色：<span className="font-medium text-slate-800">{shop.features?.length ? shop.features.join('、') : '-'}</span></p>
                  <p>标签：<span className="font-medium text-slate-800">{shop.tags?.length ? shop.tags.join('、') : '-'}</span></p>
                  <p>区域：<span className="font-medium text-slate-800">{shop.region ?? '-'}</span></p>
                  <p>人均：<span className="font-medium text-slate-800">{shop.price_per_person ?? '-'}</span></p>
                  <p>招牌：<span className="font-medium text-slate-800">{shop.signature_dish ?? '-'}</span></p>
                  <p>锐评：<span className="font-medium text-slate-800">{shop.sharp_review ?? '-'}</span></p>
                  <p>legacy sub_tags：<span className="font-medium text-slate-800">{shop.sub_tags?.length ? shop.sub_tags.join('、') : '-'}</span></p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {shop.status !== 'verified' && <button type="button" onClick={() => updateStatus(shop.id, 'verified', 'approve')} disabled={isBusy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">{isApproving ? '处理中...' : '通过上线'}</button>}
                  {shop.status !== 'rejected' && <button type="button" onClick={() => updateStatus(shop.id, 'rejected', 'reject')} disabled={isBusy} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white">{isRejecting ? '处理中...' : '驳回'}</button>}
                  <button type="button" onClick={() => setEditingShop(shop)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">编辑</button>
                  <button type="button" onClick={() => hardDelete(shop.id)} disabled={isBusy} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">{isDeleting ? '删除中...' : '永久删除'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreateModal && <AdminShopForm mode="create" submitting={saving} onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} />}
      {editingShop && <AdminShopForm mode="edit" initial={editingShop} submitting={saving} onSubmit={handleEdit} onCancel={() => setEditingShop(null)} />}
    </div>
  );
}
