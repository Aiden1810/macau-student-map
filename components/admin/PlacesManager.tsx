'use client';

import {useCallback, useEffect, useState} from 'react';
import PlaceEditor, {adminEditorRequest, type EditorTarget} from './PlaceEditor';
import {PLACE_STATUS_LABELS, type AdminPlaceRecord} from '@/lib/admin/place-editor';
import {formatPlacePrice, getPlacePresentation} from '@/lib/domain/place-types';

export default function PlacesManager({createOpen, onCreateClose, refreshSignal}: {
  createOpen: boolean; onCreateClose: () => void; refreshSignal: number;
}) {
  const [items, setItems] = useState<AdminPlaceRecord[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => {setReload(value => value + 1);}, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void adminEditorRequest<{items: AdminPlaceRecord[]}>('/api/admin/places', {cache: 'no-store', signal: controller.signal})
      .then(data => {if (active) setItems(data.items);})
      .catch(loadError => {if (active) setError(loadError instanceof Error ? loadError.message : '读取地点失败');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false; controller.abort();};
  }, [refreshSignal, reload]);
  const visible = items.filter(item => (status === 'all' || item.status === status) &&
    [item.name, item.nameEn, item.address, ...item.searchKeywords].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const activeTarget = createOpen ? {kind: 'create' as const} : editor;

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="地点资料管理">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">地点资料管理</h2><p className="mt-1 text-sm text-slate-500">管理员新增与审核通过的地点都在这里继续编辑。</p></div>
      <button type="button" disabled={loading} onClick={refresh} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">{loading ? '刷新中…' : '刷新地点'}</button></div>
    <div className="mt-4 flex flex-wrap gap-3"><input aria-label="搜索管理地点" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称、地址、补充关键词" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" />
      <select aria-label="按发布状态筛选" value={status} onChange={event => setStatus(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="all">全部状态</option>{Object.entries(PLACE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <p role="status" className="self-center text-sm text-slate-500">{loading ? '正在读取…' : `${visible.length} 个地点`}</p>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!loading && !error && visible.length === 0 && <p className="mt-4 text-sm text-slate-500">没有符合条件的地点。</p>}
    <div className="mt-4 space-y-3">{visible.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div>
      <h3 className="font-semibold text-slate-900">{item.name}</h3><p className="mt-1 text-sm text-slate-500">{item.address || '地址待补充'}</p>
      <p className="mt-1 text-xs text-slate-600">{getPlacePresentation({category: item.categorySlug, tags: item.tagIds}).label} · {PLACE_STATUS_LABELS[item.status]} · {formatPlacePrice({category: item.categorySlug, tags: item.tagIds, pricePerPerson: item.pricePerPerson})} · {item.media.length} 张图片</p>
    </div><button type="button" onClick={() => setEditor({kind: 'place', id: item.id})} className="min-h-10 rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800">编辑资料与图片</button></article>)}</div>
    {activeTarget && <PlaceEditor key={activeTarget.kind === 'create' ? 'create' : activeTarget.id} target={activeTarget}
      onSaved={refresh} onClose={() => {setEditor(null); onCreateClose();}} />}
  </section>;
}
