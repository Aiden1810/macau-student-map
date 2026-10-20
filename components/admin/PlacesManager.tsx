'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import PlaceEditor, {adminEditorRequest, type EditorTarget} from './PlaceEditor';
import BulkPlaceStatusDialog from './BulkPlaceStatusDialog';
import BulkPlaceStatusResult, {type NamedBulkPlaceResult} from './BulkPlaceStatusResult';
import {matchesAdminPlaceSearch, PLACE_STATUS_LABELS, type AdminPlaceRecord} from '@/lib/admin/place-editor';
import {getTaxonomyTagLabelZhCN} from '@/lib/domain/taxonomy';
import {withCuisineGroupLabel} from '@/lib/tags/display';
import {formatPlacePrice, getPlacePresentation} from '@/lib/domain/place-types';
import {getSelectedBulkPlaces, MAX_BULK_PLACES, type BulkPlaceResponse, type BulkPlaceStatus} from '@/lib/admin/bulk-place-selection';
import {matchesPlaceQuality} from '@/lib/admin/place-quality';
import type {QualityFilter} from '@/lib/admin/operations';

export type PlaceSummary = {total: number; published: number; draft: number; archived: number};

export default function PlacesManager({createOpen, onCreateClose, refreshSignal, onSummaryChange, qualityFilter = 'all', onQualityFilterChange, qualityFocusKey = 0}: {
  createOpen: boolean; onCreateClose: () => void; refreshSignal: number;
  onSummaryChange?: (summary: PlaceSummary | null) => void;
  qualityFilter?: QualityFilter; onQualityFilterChange?: (filter: QualityFilter) => void;
  qualityFocusKey?: number;
}) {
  const [items, setItems] = useState<AdminPlaceRecord[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<{status: BulkPlaceStatus; items: AdminPlaceRecord[]} | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<NamedBulkPlaceResult[] | null>(null);
  const refresh = useCallback(() => {setLoading(true); setReload(value => value + 1);}, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void adminEditorRequest<{items: AdminPlaceRecord[]}>('/api/admin/places', {cache: 'no-store', signal: controller.signal})
      .then(data => {if (active) {
        setItems(data.items);
        setSelectedIds(ids => ids.filter(id => data.items.some(item => item.id === id)));
      }})
      .catch(loadError => {if (active) setError(loadError instanceof Error ? loadError.message : '读取地点失败');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false; controller.abort();};
  }, [refreshSignal, reload]);
  useEffect(() => {
    onSummaryChange?.(loading || error ? null : {
      total: items.length,
      published: items.filter(item => item.status === 'published').length,
      draft: items.filter(item => item.status === 'draft').length,
      archived: items.filter(item => item.status === 'archived').length
    });
  }, [items, loading, error, onSummaryChange]);
  useEffect(() => {
    setSelectedIds([]);
    if (qualityFilter !== 'all') {setStatus('all'); setQuery('');}
  }, [qualityFilter, qualityFocusKey]);
  const visible = items.filter(item => matchesPlaceQuality(item, qualityFilter) && (status === 'all' || item.status === status) &&
    matchesAdminPlaceSearch(item, query));
  const activeTarget = createOpen ? {kind: 'create' as const} : editor;
  const selected = getSelectedBulkPlaces(selectedIds, visible);
  const selectable = visible.slice(0, MAX_BULK_PLACES);
  const disabled = loading || Boolean(error) || busy;
  const allSelected = selectable.length > 0 && selectable.every(item => selectedIds.includes(item.id));

  const toggleSelected = (id: string, checked: boolean) => {
    setBulkError(null);
    if (checked && selected.length >= MAX_BULK_PLACES) {setBulkError(`每次最多选择 ${MAX_BULK_PLACES} 家，请分批操作。`); return;}
    setSelectedIds(ids => checked ? [...new Set([...ids, id])] : ids.filter(value => value !== id));
  };
  const executeBulk = async () => {
    if (!confirmation || busyRef.current) return;
    const snapshot = confirmation;
    busyRef.current = true; setBusy(true); setBulkError(null); setBulkResults(null);
    try {
      const result = await adminEditorRequest<BulkPlaceResponse>('/api/admin/places/bulk-status', {
        method: 'POST', body: JSON.stringify({status: snapshot.status,
          items: snapshot.items.map(item => ({id: item.id, updatedAt: item.updatedAt}))})
      });
      const names = new Map(snapshot.items.map(item => [item.id, item.name]));
      setBulkResults(result.results.map(item => ({...item, name: names.get(item.id) ?? item.id})));
      setSelectedIds(result.results.filter(item => item.outcome === 'failed').map(item => item.id));
    } catch (failure) {
      setSelectedIds([]);
      setBulkError(`${failure instanceof Error ? failure.message : '请求未完成'} 请在刷新后核对实际状态，再重新勾选操作。`);
    } finally {
      busyRef.current = false; setBusy(false); setConfirmation(null); refresh();
    }
  };

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="地点资料管理">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">地点资料管理</h2><p className="mt-1 text-sm text-slate-500">管理员新增与审核通过的地点都在这里继续编辑。</p></div>
      <button type="button" disabled={loading || busy} onClick={() => {setSelectedIds([]); refresh();}} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">{loading ? '刷新中…' : '刷新地点'}</button></div>
    <div className="mt-4 flex flex-wrap gap-3"><input aria-label="搜索管理地点" value={query} disabled={busy} onChange={event => {setSelectedIds([]); setQuery(event.target.value);}} placeholder="搜索名称、地址、补充关键词" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-pine-700 focus:ring-2 focus:ring-pine-700/15" />
      <select aria-label="按发布状态筛选" value={status} disabled={busy} onChange={event => {setSelectedIds([]); setStatus(event.target.value);}} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="all">全部状态</option>{Object.entries(PLACE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {onQualityFilterChange && <select aria-label="按资料完整度筛选" value={qualityFilter} disabled={busy} onChange={event => {setSelectedIds([]); onQualityFilterChange(event.target.value as QualityFilter);}} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm">
        <option value="all">全部资料</option><option value="cover">已发布 · 缺图片</option><option value="address">已发布 · 缺地址</option><option value="coordinates">已发布 · 缺坐标</option>
      </select>}
      <p role="status" className="self-center text-sm text-slate-500">{loading ? '正在读取…' : error ? '读取失败' : `已加载 ${items.length} 个 · 筛选后 ${visible.length} 个`}</p>
    </div>
    <p className="mt-2 text-xs text-muted">这里显示新地点资料，最多加载最近更新的 500 条；历史店铺在“更多工具”中维护。</p>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-canvas px-3 py-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={allSelected} disabled={disabled || selectable.length === 0}
          onChange={event => {setBulkError(null); setSelectedIds(event.target.checked ? selectable.map(item => item.id) : []);}}
          className="h-4 w-4 accent-pine-700" />
        {visible.length > MAX_BULK_PLACES ? `选择筛选结果前${MAX_BULK_PLACES}家` : '全选当前筛选'}
      </label>
      <p className="text-sm text-muted" role="status">已选 {selected.length} 家</p>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => setConfirmation({status: 'published', items: selected})}
          className="min-h-11 rounded-xl bg-pine-700 px-3 text-sm font-semibold text-white disabled:opacity-40">批量上线</button>
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => setConfirmation({status: 'archived', items: selected})}
          className="min-h-11 rounded-xl border border-pine-700 px-3 text-sm font-semibold text-pine-800 disabled:opacity-40">批量下线</button>
        <button type="button" disabled={busy || selected.length === 0} onClick={() => setSelectedIds([])} className="min-h-11 rounded-xl px-2 text-sm text-muted disabled:opacity-40">清空选择</button>
      </div>
    </div>
    {bulkError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{bulkError}</p>}
    {bulkResults && <BulkPlaceStatusResult results={bulkResults} />}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!loading && !error && visible.length === 0 && <p className="mt-4 text-sm text-slate-500">没有符合条件的地点。</p>}
    <div className="mt-4 space-y-3">{visible.map(item => <article key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${selectedIds.includes(item.id) ? 'border-pine-700/40 bg-pine-50/40' : 'border-slate-200'}`}>
      <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center self-start">
        <input type="checkbox" aria-label={`选择${item.name}`} disabled={disabled} checked={selectedIds.includes(item.id)} onChange={event => toggleSelected(item.id, event.target.checked)} className="h-4 w-4 accent-pine-700" />
      </label><div className="min-w-0 flex-1 break-words">
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === 'published' ? 'bg-pine-50 text-pine-700' : item.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{PLACE_STATUS_LABELS[item.status]}</span></div><p className="mt-2 text-sm text-slate-500">{item.address || '地址待补充'}</p>
      <p className="mt-2 text-xs text-slate-600">{getPlacePresentation({category: item.categorySlug, tags: item.tagIds}).label} · {formatPlacePrice({category: item.categorySlug, tags: item.tagIds, pricePerPerson: item.pricePerPerson})} · {item.media.length} 张图片</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{withCuisineGroupLabel(item.tagIds.map(id => getTaxonomyTagLabelZhCN(id) ?? '未知标签')).map(label => <span key={label} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{label}</span>)}</div>
    </div><button type="button" disabled={busy} onClick={() => setEditor({kind: 'place', id: item.id})} className="min-h-11 w-full rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 disabled:opacity-50 sm:w-auto">编辑资料与图片</button></article>)}</div>
    {confirmation && <BulkPlaceStatusDialog status={confirmation.status} items={confirmation.items} busy={busy}
      onCancel={() => {if (!busyRef.current) setConfirmation(null);}} onConfirm={() => void executeBulk()} />}
    {activeTarget && <PlaceEditor key={activeTarget.kind === 'create' ? 'create' : activeTarget.id} target={activeTarget}
      onSaved={refresh} onClose={() => {setEditor(null); onCreateClose();}} />}
  </section>;
}
