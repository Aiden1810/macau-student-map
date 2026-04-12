'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {L2_TAGS} from '@/components/FilterBar';
import {Link} from '@/i18n/navigation';
import {dedupeTrimmedList, deriveRegionFromCoordinates} from '@/lib/shops/normalization';
import {buildNormalizedShopPayload} from '@/lib/shops/payload';
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
  name_i18n: Record<string, string> | null;
  address: string | null;
  amap_poi_id: string | null;
  longitude: number | null;
  latitude: number | null;
  category: ShopCategory | null;
  tags: string[] | null;
  tags_i18n: Record<string, string[]> | null;
  features: Feature[] | null;
  shop_type: ShopType | null;
  rating_label: RatingLabel | null;
  image_urls: string[] | null;
  review_text: string | null;
  review_text_i18n: Record<string, string> | null;
  student_discount: string | null;
  status: ShopStatus | null;
  created_at: string | null;
  main_category: string | null;
  sub_tags: string[] | null;
  price_per_person: number | null;
  region: ShopRegion | null;
  signature_dish: string | null;
  sharp_review: string | null;
};

type ShopFormValue = {
  name: string;
  address: string;
  amap_poi_id: string;
  longitude: string;
  latitude: string;
  category: ShopCategory;
  shop_type: ShopType;
  rating_label: RatingLabel;
  features: Feature[];
  tags: string[];
  custom_tags: string;
  name_en: string;
  image_urls: string;
  review_text: string;
  review_text_en: string;
  tags_en: string;
  status: ShopStatus;
  price_per_person: string;
  region: ShopRegion | '';
};

type BusyActionType = 'approve' | 'reject' | 'delete';
type ActionLoadingById = Record<string, BusyActionType | null>;

type AdminAuditAction = 'approve' | 'reject' | 'delete' | 'create' | 'edit';

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

type AlertLevel = 'P1' | 'P2' | 'P3';

type OpsAlert = {
  id: string;
  level: AlertLevel;
  title: string;
  reason: string;
  action: string;
};

type TrafficRangeKey = '24h' | '7d' | '30d' | '365d' | 'all';
type ShopSortKey = 'created_desc' | 'created_asc' | 'status' | 'name';
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
  action: AdminAuditAction;
  target_shop_id: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
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

function readPayloadShopName(payload: Record<string, unknown>): string | null {
  const value = payload.name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mergeAdminShop(prev: ShopRow[], incoming: ShopRow): ShopRow[] {
  const index = prev.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [incoming, ...prev];

  const next = [...prev];
  next[index] = incoming;
  return next;
}

function mapAdminRealtimeRow(row: Record<string, unknown>): ShopRow {
  const longitude = typeof row.longitude === 'number' ? row.longitude : null;
  const latitude = typeof row.latitude === 'number' ? row.latitude : null;

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    name_i18n: row.name_i18n && typeof row.name_i18n === 'object' ? (row.name_i18n as Record<string, string>) : null,
    address: typeof row.address === 'string' ? row.address : null,
    amap_poi_id: typeof row.amap_poi_id === 'string' ? row.amap_poi_id : null,
    longitude,
    latitude,
    category: (row.category as ShopCategory | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    tags_i18n: row.tags_i18n && typeof row.tags_i18n === 'object' ? (row.tags_i18n as Record<string, string[]>) : null,
    features: Array.isArray(row.features) ? (row.features as Feature[]) : null,
    shop_type: (row.shop_type as ShopType | null) ?? null,
    rating_label: (row.rating_label as RatingLabel | null) ?? null,
    image_urls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : null,
    review_text: typeof row.review_text === 'string' ? row.review_text : null,
    review_text_i18n: row.review_text_i18n && typeof row.review_text_i18n === 'object' ? (row.review_text_i18n as Record<string, string>) : null,
    student_discount: typeof row.student_discount === 'string' ? row.student_discount : null,
    status: (row.status as ShopStatus | null) ?? null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    main_category: typeof row.main_category === 'string' ? row.main_category : null,
    sub_tags: Array.isArray(row.sub_tags) ? (row.sub_tags as string[]) : null,
    price_per_person: typeof row.price_per_person === 'number' ? row.price_per_person : null,
    region: (row.region as ShopRegion | null) ?? deriveRegionFromCoordinates(longitude, latitude),
    signature_dish: typeof row.signature_dish === 'string' ? row.signature_dish : null,
    sharp_review: typeof row.sharp_review === 'string' ? row.sharp_review : null
  };
}

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
      amap_poi_id: '',
      longitude: '',
      latitude: '',
      category: 'food',
      shop_type: '正餐',
      rating_label: '暂无评分',
      features: [],
      tags: [],
      custom_tags: '',
      name_en: '',
      image_urls: '',
      review_text: '',
      review_text_en: '',
      tags_en: '',
      status: 'verified',
      price_per_person: '',
      region: ''
    };
  }

  return {
    name: shop.name ?? '',
    address: shop.address ?? '',
    amap_poi_id: shop.amap_poi_id ?? '',
    longitude: shop.longitude?.toString() ?? '',
    latitude: shop.latitude?.toString() ?? '',
    category: shop.category ?? 'food',
    shop_type: shop.shop_type ?? '正餐',
    rating_label: shop.rating_label ?? '暂无评分',
    features: shop.features ?? [],
    tags: shop.tags ?? [],
    custom_tags: '',
    name_en: shop.name_i18n?.en ?? '',
    image_urls: (shop.image_urls ?? []).join('\n'),
    review_text: shop.review_text ?? '',
    review_text_en: shop.review_text_i18n?.en ?? '',
    tags_en: (shop.tags_i18n?.en ?? []).join(', '),
    status: shop.status ?? 'pending',
    price_per_person: shop.price_per_person?.toString() ?? '',
    region: shop.region ?? ''
  };
}

function parseList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

const ADMIN_ALL_PRESET_TAGS: string[] = Object.values(L2_TAGS)
  .flatMap((groups) => groups.flatMap((group) => group.options.map((option) => option.value)))
  .filter((tag, index, arr) => arr.indexOf(tag) === index);

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

    const customTags = parseList(form.custom_tags);
    const englishTags = dedupeTrimmedList(parseList(form.tags_en), 5);
    const imageUrls = dedupeTrimmedList(parseList(form.image_urls));
    const pricePerPerson = parsePrice(form.price_per_person);

    if (form.price_per_person.trim() && pricePerPerson === null) {
      return toast.error('人均消费必须是有效数字');
    }

    if (lng !== null && lat !== null && !isLikelyMacauArea(lng, lat)) {
      return toast.error('经纬度不在澳门/珠海范围内，请确认坐标是否正确');
    }

    const payload = buildNormalizedShopPayload({
      name,
      nameEn: form.name_en.trim() || null,
      address: form.address,
      amapPoiId: form.amap_poi_id,
      longitude: lng,
      latitude: lat,
      category: form.category,
      selectedPresetTags: form.tags,
      customTags,
      ratingLabel: form.rating_label,
      shopType: form.shop_type,
      imageUrls,
      reviewText: form.review_text,
      reviewTextEn: form.review_text_en,
      tagsEn: englishTags,
      features: form.features,
      status: form.status,
      pricePerPerson,
      region: form.region || deriveRegionFromCoordinates(lng, lat)
    });

    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{mode === 'create' ? '新增店铺（管理员直发）' : '编辑店铺信息'}</h3>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">店名（中文）*</span>
            <input required value={form.name} onChange={(e) => setForm((prev) => ({...prev, name: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">店名（英文）</span>
            <input value={form.name_en} onChange={(e) => setForm((prev) => ({...prev, name_en: e.target.value}))} placeholder="e.g. Wong Chi Kei" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
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
            <span className="mb-1 block text-sm font-medium text-slate-700">AMap POI ID</span>
            <input value={form.amap_poi_id} onChange={(e) => setForm((prev) => ({...prev, amap_poi_id: e.target.value}))} placeholder="可选，例如 B0FF..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
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
              {ADMIN_ALL_PRESET_TAGS.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full border px-3 py-1 text-xs font-medium ${form.tags.includes(tag) ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">补充标签（中文，逗号/换行）</span>
            <textarea rows={2} value={form.custom_tags} onChange={(e) => setForm((prev) => ({...prev, custom_tags: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">标签（英文，逗号/换行）</span>
            <textarea rows={2} value={form.tags_en} onChange={(e) => setForm((prev) => ({...prev, tags_en: e.target.value}))} placeholder="e.g. Late Night, Student Discount" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">图片 URL（逗号/换行）</span>
            <textarea rows={3} value={form.image_urls} onChange={(e) => setForm((prev) => ({...prev, image_urls: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">评论摘要（中文）</span>
            <textarea rows={3} value={form.review_text} onChange={(e) => setForm((prev) => ({...prev, review_text: e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">评论摘要（英文）</span>
            <textarea rows={3} value={form.review_text_en} onChange={(e) => setForm((prev) => ({...prev, review_text_en: e.target.value}))} placeholder="e.g. Great for late-night snacks" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]" />
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
  const [actionLoadingById, setActionLoadingById] = useState<ActionLoadingById>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<ShopSortKey>('created_desc');
  const [newComments24h, setNewComments24h] = useState(0);
  const [trafficEvents, setTrafficEvents] = useState<TrafficEventRow[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEventRow[]>([]);
  const [shopActionEvents, setShopActionEvents] = useState<ShopActionEventRow[]>([]);
  const [commentMetrics, setCommentMetrics] = useState<CommentMetricRow[]>([]);
  const [trafficRange, setTrafficRange] = useState<TrafficRangeKey>('24h');
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeKey>('7d');
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState<string>('');
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState<string>('');
  const [analyticsSort, setAnalyticsSort] = useState<AnalyticsSortKey>('favorites');
  const [analyticsRegion, setAnalyticsRegion] = useState<ShopRegion | 'all'>('all');
  const [analyticsCategory, setAnalyticsCategory] = useState<ShopCategory | 'all'>('all');
  const [analyticsPriceBand, setAnalyticsPriceBand] = useState<AnalyticsPriceBand>('all');
  const [analyticsOnlyNew, setAnalyticsOnlyNew] = useState(false);
  const [analyticsStatus, setAnalyticsStatus] = useState<ShopStatus | 'all'>('verified');
  const [selectedAnalyticsShopId, setSelectedAnalyticsShopId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);

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
      .select('id,name,name_i18n,address,amap_poi_id,longitude,latitude,category,tags,tags_i18n,features,shop_type,rating_label,image_urls,review_text,review_text_i18n,student_discount,status,created_at,main_category,sub_tags,price_per_person,region,signature_dish,sharp_review')
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

    const favoritesRes = await supabase
      .from('favorites')
      .select('shop_id,created_at')
      .order('created_at', {ascending: false})
      .limit(20000);

    const actionsRes = await supabase
      .from('shop_action_events')
      .select('shop_id,action_type,source,created_at')
      .order('created_at', {ascending: false})
      .limit(40000);

    const commentsMetricRes = await supabase
      .from('comments')
      .select('shop_id,rating,created_at')
      .order('created_at', {ascending: false})
      .limit(40000);

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
        ((commentsMetricRes.data ?? []) as Array<{shop_id: string | null; rating: number | null; created_at: string}>)
          .filter((row) => Boolean(row.shop_id))
          .map((row) => ({shop_id: String(row.shop_id), rating: Number(row.rating ?? 0), created_at: row.created_at}))
      );
    }

    setShops((shopsRes.data ?? []).map((row) => ({...row, id: String(row.id)})) as ShopRow[]);
    if (silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  const logAdminAudit = useCallback(async ({
    action,
    targetShopId,
    note,
    metadata
  }: {
    action: AdminAuditAction;
    targetShopId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
  }) => {
    const {data: authData} = await supabase.auth.getUser();
    const actorUserId = authData.user?.id ?? null;

    const {error: logError} = await supabase.from('admin_audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      target_shop_id: targetShopId ?? null,
      note: note ?? null,
      metadata: metadata ?? null
    });

    if (logError) {
      console.warn('admin_audit_logs insert skipped:', logError.message);
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

    const channel = supabase
      .channel('shops-realtime-admin')
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'shops'},
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Record<string, unknown> | null;
            const deletedId = oldRow?.id ? String(oldRow.id) : null;
            if (!deletedId) return;

            setShops((prev) => prev.filter((shop) => shop.id !== deletedId));
            return;
          }

          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;

          const mapped = mapAdminRealtimeRow(row);
          setShops((prev) => mergeAdminShop(prev, mapped));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const pendingCount = useMemo(() => shops.filter((item) => item.status === 'pending' || item.status === null).length, [shops]);
  const verifiedCount = useMemo(() => shops.filter((item) => item.status === 'verified').length, [shops]);
  const rejectedCount = useMemo(() => shops.filter((item) => item.status === 'rejected').length, [shops]);

  const shopNameById = useMemo(() => {
    const map = new Map<string, string>();
    shops.forEach((shop) => {
      const id = shop.id?.trim();
      const name = shop.name?.trim();
      if (id && name) map.set(id, name);
    });
    return map;
  }, [shops]);

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
    const tabFiltered =
      statusTab === 'pending'
        ? shops.filter((shop) => shop.status === 'pending' || shop.status === null)
        : statusTab === 'verified'
          ? shops.filter((shop) => shop.status === 'verified')
          : shops.filter((shop) => shop.status === 'rejected');

    const keyword = searchQuery.trim().toLowerCase();
    const searched = keyword
      ? tabFiltered.filter((shop) => {
          const name = (shop.name ?? '').toLowerCase();
          const address = (shop.address ?? '').toLowerCase();
          return name.includes(keyword) || address.includes(keyword);
        })
      : tabFiltered;

    const sorted = [...searched].sort((a, b) => {
      if (sortKey === 'created_desc') {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTs - aTs;
      }
      if (sortKey === 'created_asc') {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTs - bTs;
      }
      if (sortKey === 'status') {
        const rank = (status: ShopStatus | null) => (status === 'pending' || status === null ? 0 : status === 'verified' ? 1 : 2);
        return rank(a.status) - rank(b.status);
      }
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    return sorted;
  }, [shops, statusTab, searchQuery, sortKey]);

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

  const opsAlerts = useMemo<OpsAlert[]>(() => {
    const alerts: OpsAlert[] = [];

    if (healthStats.pending >= 20) {
      alerts.push({
        id: 'pending-overload',
        level: 'P1',
        title: '待审核积压过高',
        reason: `当前待审核 ${healthStats.pending} 条，可能影响内容上新时效。`,
        action: '优先清理待审核队列，必要时先批量通过可信来源内容。'
      });
    } else if (healthStats.pending >= 8) {
      alerts.push({
        id: 'pending-growing',
        level: 'P2',
        title: '待审核队列增长',
        reason: `当前待审核 ${healthStats.pending} 条。`,
        action: '今天内完成一次审核清理，避免明日堆积。'
      });
    }

    const dataQualityMissing =
      healthStats.missingCategory + healthStats.missingShopType + healthStats.missingRatingLabel;

    if (dataQualityMissing >= 10) {
      alerts.push({
        id: 'data-quality-high-risk',
        level: 'P2',
        title: '数据质量风险偏高',
        reason: `分类/类型/口碑缺失累计 ${dataQualityMissing} 项。`,
        action: '执行“补全缺失字段”，并在新增/编辑流程强制校验必填字段。'
      });
    }

    if (trafficRange === '24h' && trafficSummary.pv > 0 && trafficSummary.uv > 0) {
      const pvPerUv = trafficSummary.pv / trafficSummary.uv;
      if (pvPerUv < 1.2) {
        alerts.push({
          id: 'retention-risk',
          level: 'P3',
          title: '会话深度偏低',
          reason: `近24小时人均浏览 ${pvPerUv.toFixed(2)} 页，可能存在内容吸引力或路径问题。`,
          action: '优先检查首页首屏内容与热门店铺卡片点击路径。'
        });
      }
    }

    if (healthStats.newShops24h === 0 && healthStats.newComments24h === 0 && trafficSummary.pv > 30) {
      alerts.push({
        id: 'supply-stagnation',
        level: 'P3',
        title: '内容供给停滞',
        reason: '近24小时无新增店铺且无新增评论。',
        action: '安排今日最少 1 家店铺新增或 3 条评论补充，保持内容新鲜度。'
      });
    }

    return alerts;
  }, [healthStats, trafficRange, trafficSummary.pv, trafficSummary.uv]);

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
          const s = shop.status ?? 'pending';
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
  }, [analyticsCategory, analyticsOnlyNew, analyticsPriceBand, analyticsRangeWindow, analyticsRegion, analyticsSort, analyticsStatus, commentMetrics, favoriteEvents, shopActionEvents, shops, trafficEvents]);

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

  const updateStatus = async (shopId: string, nextStatus: ShopStatus, action: BusyActionType) => {
    if (!isAdmin || actionLoadingById[shopId]) return;

    const confirmed = window.confirm(nextStatus === 'verified' ? '确认通过审核并上线这家店铺吗？' : '确认驳回这家店铺吗？');
    if (!confirmed) return;

    setActionLoadingById((prev) => ({...prev, [shopId]: action}));

    let updatePayload: Record<string, unknown> = {status: nextStatus};

    if (nextStatus === 'verified') {
      const currentShop = shops.find((shop) => shop.id === shopId);
      const derivedRegion = deriveRegionFromCoordinates(currentShop?.longitude ?? null, currentShop?.latitude ?? null);
      if (currentShop && !currentShop.region && derivedRegion) {
        updatePayload = {
          ...updatePayload,
          region: derivedRegion
        };
      }
    }

    const {error: updateError} = await supabase.from('shops').update(updatePayload).eq('id', shopId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`操作失败：${updateError.message}`);
      setActionLoadingById((prev) => ({...prev, [shopId]: null}));
      return;
    }

    const targetShop = shops.find((shop) => shop.id === shopId);

    await logAdminAudit({
      action: nextStatus === 'verified' ? 'approve' : 'reject',
      targetShopId: shopId,
      note: nextStatus === 'verified' ? '审核通过并上线' : '审核驳回',
      metadata: {
        nextStatus,
        shop_name: targetShop?.name ?? null
      }
    });

    toast.success(nextStatus === 'verified' ? '店铺已通过并上线' : '店铺已驳回');
    await fetchAllShops({silent: true});
    setActionLoadingById((prev) => ({...prev, [shopId]: null}));
  };

  const hardDelete = async (shopId: string) => {
    if (!isAdmin || actionLoadingById[shopId]) return;
    if (!window.confirm('确定永久删除这家店铺吗？此操作不可恢复。')) return;

    setActionLoadingById((prev) => ({...prev, [shopId]: 'delete'}));
    const {error: deleteError} = await supabase.from('shops').delete().eq('id', shopId);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`删除失败：${deleteError.message}`);
      setActionLoadingById((prev) => ({...prev, [shopId]: null}));
      return;
    }

    const targetShop = shops.find((shop) => shop.id === shopId);

    await logAdminAudit({
      action: 'delete',
      targetShopId: shopId,
      note: '管理员永久删除店铺',
      metadata: {
        shop_name: targetShop?.name ?? null
      }
    });

    toast.success('店铺已永久删除');
    await fetchAllShops({silent: true});
    setActionLoadingById((prev) => ({...prev, [shopId]: null}));
  };

  const handleCreate = async (payload: Record<string, unknown>) => {
    setSaving(true);
    const {data: createdRows, error: insertError} = await supabase.from('shops').insert(payload).select('id').limit(1);
    if (insertError) {
      setError(insertError.message);
      toast.error(`新增失败：${insertError.message}`);
      setSaving(false);
      return;
    }

    await logAdminAudit({
      action: 'create',
      targetShopId: createdRows?.[0]?.id ? String(createdRows[0].id) : null,
      note: '管理员后台直接新增店铺',
      metadata: {
        shop_name: readPayloadShopName(payload)
      }
    });

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

    await logAdminAudit({
      action: 'edit',
      targetShopId: editingShop.id,
      note: '管理员编辑店铺信息',
      metadata: {
        shop_name: readPayloadShopName(payload) ?? editingShop.name
      }
    });

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

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索店名 / 地址"
                className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#006633]"
              />

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ShopSortKey)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#006633]"
              >
                <option value="created_desc">最新创建</option>
                <option value="created_asc">最早创建</option>
                <option value="status">按状态</option>
                <option value="name">按店名</option>
              </select>

              <button type="button" onClick={() => fetchAllShops({silent: true})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">{refreshing ? '刷新中...' : '刷新列表'}</button>
              <button type="button" onClick={handleBackfillMissingFields} disabled={backfilling} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60">{backfilling ? '补全中...' : '补全缺失字段'}</button>
              <button type="button" onClick={() => setShowCreateModal(true)} className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white">新增店铺</button>
              <Link href="/" className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">返回首页</Link>
            </div>
          </div>
        </div>

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">运营告警与处置建议</h2>
              <p className="mt-1 text-xs text-slate-500">针对单人运营，自动给出今日最优先处理项（P1/P2/P3）</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">当前告警 {opsAlerts.length}</span>
          </div>

          <div className="mt-3 space-y-2">
            {opsAlerts.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">当前无显著运营风险，可按计划推进内容与质量优化。</div>
            ) : (
              opsAlerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${alert.level === 'P1' ? 'bg-rose-100 text-rose-700' : alert.level === 'P2' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-700'}`}>
                      {alert.level}
                    </span>
                    <span className="font-semibold text-slate-900">{alert.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">原因：{alert.reason}</p>
                  <p className="mt-1 text-xs font-medium text-slate-800">建议动作：{alert.action}</p>
                </div>
              ))
            )}
          </div>
        </section>

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
              <option value="verified">已审核</option>
              <option value="pending">待审核</option>
              <option value="rejected">已驳回</option>
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

        {healthStats.total === 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
            当前数据库暂无店铺，这属于正常空库阶段。你可以点击右上角“新增店铺”先录入基础样本，再做前台回归测试。
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">店铺</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">状态</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">分类信息</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">质量检查</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleShops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      当前筛选下暂无店铺记录。
                    </td>
                  </tr>
                ) : (
                  visibleShops.map((shop) => {
                    const rowAction = actionLoadingById[shop.id];
                    const isApproving = rowAction === 'approve';
                    const isRejecting = rowAction === 'reject';
                    const isDeleting = rowAction === 'delete';
                    const isBusy = Boolean(rowAction);
                    const missingFields = [
                      !shop.category ? 'category' : null,
                      !shop.shop_type ? 'shop_type' : null,
                      !shop.rating_label ? 'rating_label' : null,
                      !shop.address ? 'address' : null
                    ].filter(Boolean) as string[];

                    return (
                      <tr key={shop.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">{shop.name || '未命名店铺'}</p>
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{shop.address || '暂无地址'}</p>
                          <p className="mt-1 text-xs text-slate-500">区域：{shop.region ?? '-'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            (shop.status === 'pending' || shop.status === null)
                              ? 'bg-amber-100 text-amber-800'
                              : shop.status === 'verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {shop.status ?? 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          <p>频道：<span className="font-medium text-slate-800">{shop.category ?? '-'}</span></p>
                          <p className="mt-1">类型：<span className="font-medium text-slate-800">{shop.shop_type ?? '-'}</span></p>
                          <p className="mt-1">口碑：<span className="font-medium text-slate-800">{shop.rating_label ?? '-'}</span></p>
                          <p className="mt-1">标签：<span className="font-medium text-slate-800">{shop.tags?.length ? shop.tags.join('、') : '-'}</span></p>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          {missingFields.length > 0 ? (
                            <span className="inline-flex rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700">缺失：{missingFields.join(', ')}</span>
                          ) : (
                            <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">字段完整</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {shop.status !== 'verified' && (
                              <button
                                type="button"
                                aria-label={`通过店铺 ${shop.name || shop.id}`}
                                onClick={() => updateStatus(shop.id, 'verified', 'approve')}
                                disabled={isBusy}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {isApproving ? '处理中...' : '通过'}
                              </button>
                            )}
                            {shop.status !== 'rejected' && (
                              <button
                                type="button"
                                aria-label={`驳回店铺 ${shop.name || shop.id}`}
                                onClick={() => updateStatus(shop.id, 'rejected', 'reject')}
                                disabled={isBusy}
                                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {isRejecting ? '处理中...' : '驳回'}
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`编辑店铺 ${shop.name || shop.id}`}
                              onClick={() => setEditingShop(shop)}
                              disabled={isBusy}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              aria-label={`删除店铺 ${shop.name || shop.id}`}
                              onClick={() => hardDelete(shop.id)}
                              disabled={isBusy}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {isDeleting ? '删除中...' : '删除'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && <AdminShopForm mode="create" submitting={saving} onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} />}
      {editingShop && <AdminShopForm mode="edit" initial={editingShop} submitting={saving} onSubmit={handleEdit} onCancel={() => setEditingShop(null)} />}
    </div>
  );
}
