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
};

type BusyActionType = 'approve' | 'reject' | 'delete';
type BusyAction = {shopId: string; action: BusyActionType} | null;

const CATEGORY_OPTIONS: Array<{value: ShopCategory; label: string}> = [
  {value: 'food', label: '美食'},
  {value: 'drink', label: '饮品'},
  {value: 'vibe', label: '氛围'},
  {value: 'deal', label: '优惠'}
];

const SHOP_TYPE_OPTIONS: ShopType[] = ['正餐', '快餐小吃', '饮品甜点', '服务'];
const RATING_OPTIONS: RatingLabel[] = ['封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分'];
const FEATURE_OPTIONS: Feature[] = ['有折扣', '学生价', '深夜营业', '适合拍照', '外卖可达'];

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
      status: 'verified'
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
    status: shop.status ?? 'pending'
  };
}

function parseList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

    const mergedTags = Array.from(new Set([...form.tags, ...parseList(form.custom_tags)])).slice(0, 5);

    const payload: Record<string, unknown> = {
      name,
      address: form.address.trim() || null,
      longitude: lng,
      latitude: lat,
      category: form.category,
      shop_type: form.shop_type,
      rating_label: form.rating_label,
      features: form.features,
      tags: mergedTags,
      image_urls: parseList(form.image_urls),
      review_text: form.review_text.trim() || null,
      student_discount: form.student_discount.trim() || null,
      status: form.status
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
  const [statusTab, setStatusTab] = useState<'pending' | 'verified'>('pending');

  const fetchAllShops = useCallback(async (opts?: {silent?: boolean}) => {
    const silent = opts?.silent ?? false;
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);

    const {data, error: fetchError} = await supabase
      .from('shops')
      .select('id,name,address,longitude,latitude,category,tags,features,shop_type,rating_label,image_urls,review_text,student_discount,status,created_at,sub_tags')
      .or('status.in.(pending,verified,rejected),status.is.null')
      .order('created_at', {ascending: false});

    if (fetchError) {
      setError(fetchError.message);
      setShops([]);
      if (silent) setRefreshing(false); else setLoading(false);
      return;
    }

    setShops((data ?? []).map((row) => ({...row, id: String(row.id)})) as ShopRow[]);
    if (silent) setRefreshing(false); else setLoading(false);
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

  const visibleShops = useMemo(
    () => shops.filter((shop) => (statusTab === 'pending' ? shop.status === 'pending' || shop.status === null : shop.status === 'verified')),
    [shops, statusTab]
  );

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
    const {error: insertError} = await supabase.from('shops').insert({...payload, status: 'verified'});
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
              <button type="button" onClick={() => fetchAllShops({silent: true})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">{refreshing ? '刷新中...' : '刷新列表'}</button>
              <button type="button" onClick={() => setShowCreateModal(true)} className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white">新增店铺</button>
              <Link href="/" className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">返回首页</Link>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

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
