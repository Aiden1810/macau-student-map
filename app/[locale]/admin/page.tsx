'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

type ShopStatus = 'pending' | 'verified' | 'rejected';

type ShopRow = {
  id: string;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
  category: string | null;
  main_category: string | null;
  sub_tags: string[] | null;
  tags: string[] | null;
  image_urls: string[] | null;
  review_text: string | null;
  student_discount: string | null;
  status: ShopStatus | null;
  created_at: string | null;
};

type ShopFormValue = {
  name: string;
  address: string;
  longitude: string;
  latitude: string;
  category: string;
  main_category: string;
  sub_tags: string[];
  custom_sub_tags: string;
  tags: string;
  image_urls: string;
  review_text: string;
  student_discount: string;
  status: ShopStatus;
};

type BusyActionType = 'approve' | 'reject' | 'delete';

type BusyAction = {
  shopId: string;
  action: BusyActionType;
} | null;

const MAIN_CATEGORIES = ['美食', '氛围', '评价'] as const;

const SUB_TAG_OPTIONS: Record<(typeof MAIN_CATEGORIES)[number], string[]> = {
  美食: ['咖啡', '炸鸡', '茶餐厅', '甜品', '正餐', '夜宵', '日料', '奶茶', '韩料', '冰淇淋'],
  氛围: ['放松', '自习', '适合拍照', '安静'],
  评价: ['封神之作', '值得一试', '中规中矩', '建议避雷', '暂无评分']
};

function toFormValue(shop?: ShopRow | null): ShopFormValue {
  if (!shop) {
    return {
      name: '',
      address: '',
      longitude: '',
      latitude: '',
      category: '餐饮',
      main_category: '美食',
      sub_tags: [],
      custom_sub_tags: '',
      tags: '',
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
    category: shop.category ?? '餐饮',
    main_category: shop.main_category ?? '美食',
    sub_tags: shop.sub_tags ?? [],
    custom_sub_tags: '',
    tags: (shop.tags ?? []).join(', '),
    image_urls: (shop.image_urls ?? []).join('\n'),
    review_text: shop.review_text ?? '',
    student_discount: shop.student_discount ?? '',
    status: (shop.status as ShopStatus) ?? 'pending'
  };
}

function parseCommaValues(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLineOrCommaValues(input: string): string[] {
  return input
    .split(/\n|,/)
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

  const currentSubTagOptions = useMemo(() => {
    const key = (form.main_category || '美食') as keyof typeof SUB_TAG_OPTIONS;
    return SUB_TAG_OPTIONS[key] ?? SUB_TAG_OPTIONS['美食'];
  }, [form.main_category]);

  const toggleSubTag = (tag: string) => {
    setForm((prev) => {
      const exists = prev.sub_tags.includes(tag);
      return {
        ...prev,
        sub_tags: exists ? prev.sub_tags.filter((item) => item !== tag) : [...prev.sub_tags, tag]
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const customSubTags = parseCommaValues(form.custom_sub_tags);
    const mergedSubTags = Array.from(new Set([...form.sub_tags, ...customSubTags]));

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      category: form.category.trim() || null,
      main_category: form.main_category.trim() || null,
      sub_tags: mergedSubTags,
      tags: parseCommaValues(form.tags),
      image_urls: parseLineOrCommaValues(form.image_urls),
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
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({...prev, name: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">地址</span>
            <input
              value={form.address}
              onChange={(e) => setForm((prev) => ({...prev, address: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Longitude</span>
            <input
              value={form.longitude}
              onChange={(e) => setForm((prev) => ({...prev, longitude: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Latitude</span>
            <input
              value={form.latitude}
              onChange={(e) => setForm((prev) => ({...prev, latitude: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">旧分类 category</span>
            <input
              value={form.category}
              onChange={(e) => setForm((prev) => ({...prev, category: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">主分类 main_category *</span>
            <select
              required
              value={form.main_category}
              onChange={(e) => setForm((prev) => ({...prev, main_category: e.target.value, sub_tags: []}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            >
              {MAIN_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">子标签 sub_tags</p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {currentSubTagOptions.map((tag) => {
                const active = form.sub_tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSubTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-[#FFCC00] bg-[#FFF9E6] text-[#006633]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">补充子标签（英文逗号分隔）</span>
            <input
              value={form.custom_sub_tags}
              onChange={(e) => setForm((prev) => ({...prev, custom_sub_tags: e.target.value}))}
              placeholder="例如：网红店, 奶油意面"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">tags（逗号分隔）</span>
            <input
              value={form.tags}
              onChange={(e) => setForm((prev) => ({...prev, tags: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">图片 URL（换行或逗号分隔）</span>
            <textarea
              rows={3}
              value={form.image_urls}
              onChange={(e) => setForm((prev) => ({...prev, image_urls: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">评论摘要</span>
            <textarea
              rows={3}
              value={form.review_text}
              onChange={(e) => setForm((prev) => ({...prev, review_text: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">学生优惠</span>
            <input
              value={form.student_discount}
              onChange={(e) => setForm((prev) => ({...prev, student_discount: e.target.value}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">状态 status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({...prev, status: e.target.value as ShopStatus}))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006633]"
            >
              <option value="pending">pending</option>
              <option value="verified">verified</option>
              <option value="rejected">rejected</option>
            </select>
          </label>

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
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

  const fetchAllShops = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {data, error: fetchError} = await supabase
      .from('shops')
      .select(
        'id,name,address,longitude,latitude,category,main_category,sub_tags,tags,image_urls,review_text,student_discount,status,created_at'
      )
      .or('status.in.(pending,verified,rejected),status.is.null')
      .order('created_at', {ascending: false});

    if (fetchError) {
      setError(fetchError.message);
      setShops([]);
      setLoading(false);
      return;
    }

    setShops((data ?? []).map((row) => ({...row, id: String(row.id)})));
    setLoading(false);
  }, []);

  const checkAdminRole = useCallback(async () => {
    const {data: authData, error: authError} = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const {data: profile, error: roleError} = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

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

  const pendingCount = useMemo(() => shops.filter((item) => item.status === 'pending').length, [shops]);

  const updateStatus = async (shopId: string, nextStatus: ShopStatus, action: BusyActionType) => {
    if (!isAdmin || busyAction) return;

    setBusyAction({shopId, action});
    setError(null);

    const {error: updateError} = await supabase.from('shops').update({status: nextStatus}).eq('id', shopId);

    if (updateError) {
      setError(updateError.message);
      setBusyAction(null);
      return;
    }

    await fetchAllShops();
    setBusyAction(null);
  };

  const hardDelete = async (shopId: string) => {
    if (!isAdmin || busyAction) return;

    const confirmed = window.confirm('确定永久删除这家店铺吗？此操作不可恢复。');
    if (!confirmed) return;

    setBusyAction({shopId, action: 'delete'});
    setError(null);

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

  const clearReviewText = async (shopId: string) => {
    if (!isAdmin) return;

    const confirmed = window.confirm('确认清空该店铺的文字评价？');
    if (!confirmed) return;

    const {error: updateError} = await supabase.from('shops').update({review_text: null}).eq('id', shopId);

    if (updateError) {
      setError(updateError.message);
      toast.error(`清空评价失败：${updateError.message}`);
      return;
    }

    toast.success('文字评价已清空');
    await fetchAllShops();
  };

  const removeImageAtIndex = async (shop: ShopRow, index: number) => {
    if (!isAdmin) return;

    const currentImages = shop.image_urls ?? [];

    if (index < 0 || index >= currentImages.length) {
      return;
    }

    const confirmed = window.confirm('确认删除这张图片？');
    if (!confirmed) return;

    const nextImages = currentImages.filter((_, imageIndex) => imageIndex !== index);

    const {error: updateError} = await supabase
      .from('shops')
      .update({image_urls: nextImages.length > 0 ? nextImages : null})
      .eq('id', shop.id);

    if (updateError) {
      setError(updateError.message);
      toast.error(`删除图片失败：${updateError.message}`);
      return;
    }

    toast.success('图片已删除');
    await fetchAllShops();
  };

  const clearAllImages = async (shopId: string) => {
    if (!isAdmin) return;

    const confirmed = window.confirm('确认清空所有图片？');
    if (!confirmed) return;

    const {error: updateError} = await supabase.from('shops').update({image_urls: null}).eq('id', shopId);

    if (updateError) {
      setError(updateError.message);
      toast.error(`清空图片失败：${updateError.message}`);
      return;
    }

    toast.success('图片已全部清空');
    await fetchAllShops();
  };

  const handleCreate = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);

    const {error: insertError} = await supabase.from('shops').insert({...payload, status: 'verified'});

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setShowCreateModal(false);
    setSaving(false);
    await fetchAllShops();
  };

  const handleEdit = async (payload: Record<string, unknown>) => {
    if (!editingShop) return;

    setSaving(true);
    setError(null);

    const {error: updateError} = await supabase.from('shops').update(payload).eq('id', editingShop.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setEditingShop(null);
    setSaving(false);
    await fetchAllShops();
  };

  const statusLabel = (status: ShopStatus | null) => {
    if (status === 'verified') return '已上线';
    if (status === 'rejected') return '已驳回';
    if (status === null) return '待审核(空状态)';
    return '待审核';
  };

  const statusClassName = (status: ShopStatus | null) => {
    if (status === 'verified') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-rose-100 text-rose-700';
    if (status === null) return 'bg-amber-100 text-amber-700';
    return 'bg-amber-100 text-amber-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          加载管理员数据中...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">无访问权限</h1>
          <p className="mt-2 text-sm text-slate-600">请使用管理员账号登录后再访问后台。</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/admin-login" className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white">
              前往登录
            </Link>
            <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              返回首页
            </Link>
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
              <p className="mt-1 text-sm text-slate-600">可审核投稿、直接发布店铺、编辑分类与标签。</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                待审核：{pendingCount}
              </span>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-[#006633] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                新增店铺
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            暂无店铺数据。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shops.map((shop) => {
              const isApproving = busyAction?.shopId === shop.id && busyAction.action === 'approve';
              const isRejecting = busyAction?.shopId === shop.id && busyAction.action === 'reject';
              const isDeleting = busyAction?.shopId === shop.id && busyAction.action === 'delete';
              const isBusy = busyAction?.shopId === shop.id;

              return (
                <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900">{shop.name || '未命名店铺'}</h2>
                      <p className="mt-1 text-xs text-slate-500">{shop.address || '暂无地址'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(shop.status)}`}>
                      {statusLabel(shop.status)}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p>
                      主分类：<span className="font-medium text-slate-800">{shop.main_category ?? '-'}</span>
                    </p>
                    <p>
                      子标签：<span className="font-medium text-slate-800">{shop.sub_tags?.length ? shop.sub_tags.join('、') : '-'}</span>
                    </p>
                    <p>
                      旧 tags：<span className="font-medium text-slate-800">{shop.tags?.length ? shop.tags.join(', ') : '-'}</span>
                    </p>
                    <p>
                      文字评价：
                      <span className="ml-1 font-medium text-slate-800">{shop.review_text?.trim() ? '有内容' : '空'}</span>
                    </p>
                    <p>
                      图片数量：<span className="font-medium text-slate-800">{shop.image_urls?.length ?? 0}</span>
                    </p>
                  </div>

                  {shop.image_urls && shop.image_urls.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">图片管理</p>
                      <div className="space-y-2">
                        {shop.image_urls.map((url, index) => (
                          <div key={`${shop.id}-img-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-xs text-indigo-600 hover:underline"
                            >
                              {url}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeImageAtIndex(shop, index)}
                              className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              删除该图
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => clearReviewText(shop.id)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      清空文字评价
                    </button>

                    <button
                      type="button"
                      onClick={() => clearAllImages(shop.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      清空所有图片
                    </button>
                    {shop.status !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(shop.id, 'verified', 'approve')}
                        disabled={isBusy}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {isApproving ? '处理中...' : '通过上线'}
                      </button>
                    )}

                    {shop.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(shop.id, 'rejected', 'reject')}
                        disabled={isBusy}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {isRejecting ? '处理中...' : '驳回'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingShop(shop)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      编辑
                    </button>

                    <button
                      type="button"
                      onClick={() => hardDelete(shop.id)}
                      disabled={isBusy}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {isDeleting ? '删除中...' : '永久删除'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <AdminShopForm mode="create" submitting={saving} onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} />
      )}

      {editingShop && (
        <AdminShopForm
          mode="edit"
          initial={editingShop}
          submitting={saving}
          onSubmit={handleEdit}
          onCancel={() => setEditingShop(null)}
        />
      )}
    </div>
  );
}
