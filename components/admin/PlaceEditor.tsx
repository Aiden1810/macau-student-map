'use client';

import Image from 'next/image';
import {useEffect, useMemo, useRef, useState} from 'react';
import {z} from 'zod';
import LaunchCategorySelector from '@/components/LaunchCategorySelector';
import PrimaryTagSelector from '@/components/PrimaryTagSelector';
import AmapPoiSelector from '@/components/AmapPoiSelector';
import ImageUpload from '@/components/ImageUpload';
import {authenticatedApiRequest} from '@/lib/api/client';
import {supabase} from '@/lib/supabase';
import {getLaunchTagOptions, getPlacePresentation, isPrimaryTag, selectLaunchCategory, type LaunchCategoryKey} from '@/lib/domain/place-types';
import {getTaxonomyTagLabelZhCN, TAG_CATALOG} from '@/lib/domain/taxonomy';
import type {AmapPoiOption} from '@/lib/amap/place-search';
import {deriveRegionFromCoordinates} from '@/lib/shops/normalization';
import {PLACE_STATUS_LABELS, prepareAdminPlaceInput, type AdminPlaceInput, type AdminPlaceRecord, type EditorMedia, type SubmissionEditorRecord} from '@/lib/admin/place-editor';

export type EditorTarget = {kind: 'create'} | {kind: 'place' | 'submission'; id: string};
type PendingImage = {id: string; file: File};
type SavedResult = {placeId: string; mediaWarnings?: {mediaId: string; message: string}[]};
const REGIONS = [{value: 'macau-peninsula', label: '澳门半岛'}, {value: 'taipa', label: '氹仔'}, {value: 'coloane', label: '路环'},
  {value: 'hengqin', label: '横琴'}, {value: 'zhuhai', label: '珠海'}, {value: 'other', label: '其他'}] as const;
const EMPTY: AdminPlaceInput = {name: '', nameEn: null, address: null, categorySlug: 'food', region: null,
  longitude: null, latitude: null, pricePerPerson: null, tagIds: [], searchKeywords: [], status: 'published'};
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700';
const REGION_FROM_LEGACY: Record<string, AdminPlaceInput['region']> = {
  澳门半岛: 'macau-peninsula', 氹仔岛: 'taipa', 路环岛: 'coloane', 横琴区: 'hengqin', 香洲区: 'zhuhai', 其它: 'other'
};

export async function adminEditorRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const {data} = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('管理员会话已过期，请重新登录');
  return authenticatedApiRequest<T>(path, data.session.access_token, init);
}

function PendingPreview({image}: {image: PendingImage}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(image.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image.file]);
  return url ? <Image src={url} alt={image.file.name} width={180} height={120} unoptimized className="h-24 w-full rounded-lg object-cover" /> : null;
}

export default function PlaceEditor({target, onClose, onSaved}: {
  target: EditorTarget; onClose: () => void; onSaved: () => Promise<void> | void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(target.kind !== 'create');
  const [ready, setReady] = useState(target.kind === 'create');
  const [imageProcessing, setImageProcessing] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<AmapPoiOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AdminPlaceInput>(EMPTY);
  const [numbers, setNumbers] = useState({longitude: '', latitude: '', price: ''});
  const [launch, setLaunch] = useState<LaunchCategoryKey | null>('food');
  const [keywords, setKeywords] = useState('');
  const [media, setMedia] = useState<EditorMedia[]>([]);
  const [files, setFiles] = useState<PendingImage[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [originalNotes, setOriginalNotes] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [savedId, setSavedId] = useState<string | null>(target.kind === 'place' ? target.id : null);
  const [changedOnServer, setChangedOnServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastPublishBody, setLastPublishBody] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const targetId = target.kind === 'create' ? null : target.id;
  useEffect(() => {
    if (!targetId || target.kind === 'create') return;
    let active = true;
    const controller = new AbortController();
    void adminEditorRequest<AdminPlaceRecord | SubmissionEditorRecord>(
      `/api/admin/${target.kind === 'place' ? 'places' : 'submissions'}/${targetId}`, {signal: controller.signal, cache: 'no-store'}
    ).then(data => {
      if (!active) return;
      setForm({name: data.name, nameEn: data.nameEn, address: data.address, categorySlug: data.categorySlug,
        region: data.region, longitude: data.longitude, latitude: data.latitude, pricePerPerson: data.pricePerPerson,
        tagIds: data.tagIds, searchKeywords: data.searchKeywords, status: data.status});
      setNumbers({longitude: data.longitude?.toString() ?? '', latitude: data.latitude?.toString() ?? '', price: data.pricePerPerson?.toString() ?? ''});
      setLaunch(getPlacePresentation({category: data.categorySlug, tags: data.tagIds}).launch);
      setKeywords(data.searchKeywords.join('，'));
      setMedia(data.media);
      if ('pendingSubmissionIds' in data) setPendingSubmissions(data.pendingSubmissionIds ?? []);
      setReady(true);
      if ('version' in data) {setVersion(data.version); setOriginalNotes(data.notes);}
    }).catch(loadError => {if (active) setError(loadError instanceof Error ? loadError.message : '读取资料失败');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false; controller.abort();};
  }, [target.kind, targetId]);

  const primaryTags = useMemo(() => launch ? getLaunchTagOptions(launch) : TAG_CATALOG.filter(tag => isPrimaryTag(tag)), [launch]);
  const additionalTags = TAG_CATALOG.filter(tag => !isPrimaryTag(tag));
  const selectTag = (id: string) => {
    if (!form.tagIds.includes(id) && form.tagIds.length >= 8) {setError('标准标签最多选择 8 个'); return;}
    setForm(current => ({...current, tagIds: current.tagIds.includes(id) ? current.tagIds.filter(value => value !== id) : [...current.tagIds, id]}));
  };
  const tagButtons = (tags: readonly {id: string; slug: string}[]) => <div className="flex flex-wrap gap-2">{tags.map(tag => (
    <button key={tag.id} type="button" aria-pressed={form.tagIds.includes(tag.id)} onClick={() => selectTag(tag.id)}
      className={`min-h-9 rounded-full border px-3 py-1.5 text-sm ${form.tagIds.includes(tag.id) ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
      {getTaxonomyTagLabelZhCN(tag.slug)}
    </button>
  ))}</div>;

  const finish = async () => {await onSaved(); onClose();};
  const close = async () => {if (busyRef.current) return; if (changedOnServer) await onSaved(); onClose();};
  const retryOriginalImages = async () => {
    if (busyRef.current || (!savedId && !lastPublishBody)) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const result = savedId
        ? {placeId: savedId, ...await adminEditorRequest<{mediaWarnings: {message: string}[]}>(`/api/admin/places/${savedId}/media/retry`, {method: 'POST'})}
        : await adminEditorRequest<SavedResult>(`/api/admin/submissions/${targetId}/publish`, {method: 'POST', body: lastPublishBody});
      setWarnings((result.mediaWarnings ?? []).map(item => item.message));
      const updated = await adminEditorRequest<AdminPlaceRecord>(`/api/admin/places/${result.placeId}`);
      setMedia(updated.media);
      setPendingSubmissions(updated.pendingSubmissionIds ?? []);
      setChangedOnServer(true);
    } catch (retryError) {setError(retryError instanceof Error ? retryError.message : '重试失败');}
    finally {busyRef.current = false; setBusy(false);}
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current || loading || !ready || imageProcessing) return;
    busyRef.current = true; setBusy(true); setError(null);
    let persisted = savedId;
    try {
      const number = (value: string) => {
        if (!value.trim()) return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) throw new Error('经纬度和消费参考需要填写有效数字');
        return parsed;
      };
      const input = prepareAdminPlaceInput({...form, longitude: number(numbers.longitude), latitude: number(numbers.latitude),
        pricePerPerson: number(numbers.price), searchKeywords: keywords.split(/[,，\n]/).map(value => value.trim()).filter(Boolean)});
      let result: SavedResult;
      if (persisted) result = await adminEditorRequest<SavedResult>(`/api/admin/places/${persisted}`, {method: 'PATCH', body: JSON.stringify(input)});
      else if (target.kind === 'submission') {
        if (version === null) throw new Error('未读取投稿版本，请重新打开审核');
        const body = JSON.stringify({version, place: {...input, status: 'published'}, reviewNote: reviewNote.trim() || null});
        setLastPublishBody(body);
        result = await adminEditorRequest<SavedResult>(`/api/admin/submissions/${target.id}/publish`, {method: 'POST', body});
      } else result = await adminEditorRequest<SavedResult>('/api/admin/places', {method: 'POST', body: JSON.stringify(input)});
      persisted = result.placeId;
      setSavedId(persisted); setChangedOnServer(true);
      const nextWarnings = (result.mediaWarnings ?? []).map(item => item.message);
      if (nextWarnings.length) setWarnings(nextWarnings);
      for (const image of files) {
        const upload = new FormData(); upload.set('file', image.file);
        const uploaded = await adminEditorRequest<EditorMedia>(`/api/admin/places/${persisted}/media`, {method: 'POST', body: upload});
        setMedia(current => [...current, uploaded]);
        setFiles(current => current.filter(file => file.id !== image.id));
      }
      if (nextWarnings.length || warnings.length) {
        const updated = await adminEditorRequest<AdminPlaceRecord>(`/api/admin/places/${persisted}`);
        setMedia(updated.media);
      } else await finish();
    } catch (saveError) {
      const message = saveError instanceof z.ZodError ? saveError.issues[0]?.message : saveError instanceof Error ? saveError.message : '保存失败';
      setError(`${persisted ? '地点资料已保存；本次操作未全部完成，可重试。' : ''}${message}`);
    } finally {busyRef.current = false; setBusy(false);}
  };

  const removeMedia = async (item: EditorMedia) => {
    if (!savedId || busyRef.current) return;
    if (!window.confirm('确定移除这张地点图片吗？')) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      await adminEditorRequest(`/api/admin/places/${savedId}/media?mediaId=${encodeURIComponent(item.id)}`, {method: 'DELETE'});
      setMedia(current => current.filter(row => row.id !== item.id)); setChangedOnServer(true);
    } catch (removeError) {setError(removeError instanceof Error ? removeError.message : '移除失败');}
    finally {busyRef.current = false; setBusy(false);}
  };

  return <dialog ref={dialogRef} onCancel={event => {event.preventDefault(); void close();}}
    aria-labelledby="place-editor-title" className="m-auto max-h-[92dvh] w-[min(95vw,52rem)] overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
    <h2 id="place-editor-title" className="text-xl font-bold">{target.kind === 'submission' ? '编辑并审核投稿' : target.kind === 'create' ? '新增地点' : '编辑地点资料'}</h2>
    <p className="mt-1 text-sm text-slate-500">{target.kind === 'submission' ? '补全资料后发布，保留用户原稿与审核记录。' : '地点类型与用户投稿保持一致，评分由用户评价计算。'}</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {changedOnServer && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">地点资料已保存。{files.length ? '剩余图片可继续上传，重试不会重复创建地点。' : ''}</p>}
    {(warnings.length > 0 || pendingSubmissions.length > 0) && <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p>地点已发布，部分投稿图片处理尚未完成。请重试，或稍后在地点管理中检查图片。</p>
      <p className="mt-1">{warnings.length ? `${warnings.length} 项处理提示` : '有待恢复的投稿图片处理任务'}</p>
      <button type="button" disabled={busy} onClick={() => void retryOriginalImages()} className="mt-2 underline">重试投稿图片处理</button>
    </div>}
    {loading ? <p className="py-8 text-sm text-slate-500">正在读取完整资料和图片…</p> : <form onSubmit={event => void save(event)} className="mt-5 space-y-5">
      <fieldset disabled={busy || !ready} className="space-y-5 disabled:opacity-70">
        <LaunchCategorySelector value={launch} onChange={key => {
          const next = selectLaunchCategory(key, form.tagIds);
          setLaunch(key); setForm(current => ({...current, categorySlug: next.category, tagIds: next.tagIds})); setError(null);
        }} />
        {!launch && <p className="text-sm text-amber-800">这是其他生活分类，可保留原分类，或选择上面的地点类型。</p>}
        <AmapPoiSelector selectedPlace={selectedPoi} onSelect={poi => {
          setSelectedPoi(poi);
          const derived = deriveRegionFromCoordinates(poi.coordinates[0], poi.coordinates[1]);
          setForm(current => ({...current, name: poi.name, address: poi.fullAddress,
            region: derived ? REGION_FROM_LEGACY[derived] ?? null : null}));
          setNumbers(current => ({...current, longitude: String(poi.coordinates[0]), latitude: String(poi.coordinates[1])}));
        }} onClearSelection={() => setSelectedPoi(null)} labels={{label: '搜索地图地点', placeholder: '搜索澳门或珠海的店名并选择具体分店',
          searching: '搜索中…', empty: '没有找到地点，可在高级信息填写坐标', searchFailed: '地图搜索失败，请重试', unnamedPlace: '未命名地点', poiId: '地图地点编号'}} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-medium">地点名称 *</span><input required maxLength={120} value={form.name} onChange={event => setForm({...form, name: event.target.value})} className={INPUT} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">地址</span><input maxLength={500} value={form.address ?? ''} onChange={event => setForm({...form, address: event.target.value || null})} className={INPUT} /></label>
        </div>
        <fieldset><legend className="mb-2 text-sm font-medium">具体类型 * <span className="font-normal text-slate-500">与补充标签合计最多 8 个</span></legend><PrimaryTagSelector tags={primaryTags} selected={form.tagIds} onToggle={selectTag} /></fieldset>
        <label className="block max-w-sm"><span className="mb-1 block text-sm font-medium">{form.categorySlug === 'food' ? '人均消费参考（人民币）' : '消费参考（人民币／人次）'}</span>
          <input type="number" min="0" max="100000" step="0.01" value={numbers.price} onChange={event => setNumbers({...numbers, price: event.target.value})} placeholder="可不填；0 表示免费" className={INPUT} /></label>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">补充标签（可选）</summary>
          <p className="my-2 text-xs text-slate-500">用于场景筛选和搜索，例如聚餐、学生优惠。请按实际情况选择。</p>{tagButtons(additionalTags)}
        </details>
        <section aria-label="地点图片"><h3 className="mb-2 text-sm font-medium">图片（{media.length + files.length}/5）</h3>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-2">
              {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="查看原图"><Image src={item.url} alt="地点图片" width={180} height={120} unoptimized className="h-24 w-full rounded-lg object-cover" /></a> : <p className="text-xs text-amber-800">{item.previewError ?? '图片预览不可用'}</p>}
              {savedId && <button type="button" onClick={() => void removeMedia(item)} className="mt-2 min-h-8 text-xs text-rose-700">移除图片</button>}
            </div>)}
            {files.map(item => <div key={item.id} className="rounded-lg border border-emerald-200 p-2"><PendingPreview image={item} /><span className="text-xs text-slate-500">待保存上传</span>
              <button type="button" onClick={() => setFiles(current => current.filter(row => row.id !== item.id))} className="ml-2 min-h-8 text-xs text-rose-700">移除</button></div>)}
          </div>
          <ImageUpload disabled={busy || media.length + files.length >= 5} onProcessingChange={setImageProcessing} buttonText="选择图片" onUpload={file => {
            setFiles(current => media.length + current.length >= 5 ? current : [...current, {id: crypto.randomUUID(), file}]);
          }} />
          <p className="mt-2 text-xs text-slate-500">选图后会压缩，保存资料时上传。用户原稿图片在审核前使用私有预览，发布后可在地点管理移除。</p>
        </section>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">管理员补充信息（可选）</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1 block text-sm">英文名称</span><input maxLength={120} value={form.nameEn ?? ''} onChange={event => setForm({...form, nameEn: event.target.value || null})} className={INPUT} /></label>
            <label><span className="mb-1 block text-sm">区域</span><select value={form.region ?? ''} onChange={event => setForm({...form, region: (event.target.value || null) as AdminPlaceInput['region']})} className={INPUT}><option value="">未填写</option>{REGIONS.map(region => <option key={region.value} value={region.value}>{region.label}</option>)}</select></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-sm">补充搜索关键词</span><textarea rows={2} value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="逗号或换行分隔，例如：牛腩、同学聚餐；最多 8 个" className={INPUT} /><span className="text-xs text-slate-500">支持关键词文字匹配。例如添加“牛腩”后可搜“牛腩”，不代表能理解任意整句话。</span></label>
          </div>
        </details>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">高级地图信息</summary><p className="my-2 text-xs text-slate-500">从地图搜索选择地点可自动填入坐标，请勿重复转换坐标。</p>
          <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-sm">经度</span><input type="number" step="any" value={numbers.longitude} onChange={event => setNumbers({...numbers, longitude: event.target.value})} className={INPUT} /></label>
            <label><span className="mb-1 block text-sm">纬度</span><input type="number" step="any" value={numbers.latitude} onChange={event => setNumbers({...numbers, latitude: event.target.value})} className={INPUT} /></label></div>
        </details>
        {target.kind === 'submission' && <section className="space-y-3 rounded-xl bg-slate-50 p-3">
          <p className="whitespace-pre-wrap text-sm text-slate-600">用户原始备注：{originalNotes || '未填写'}</p>
          <label className="block"><span className="mb-1 block text-sm font-medium">审核备注</span><textarea maxLength={1000} rows={2} value={reviewNote} onChange={event => setReviewNote(event.target.value)} className={INPUT} /></label>
        </section>}
        {target.kind !== 'submission' && <label className="block max-w-sm"><span className="mb-1 block text-sm font-medium">发布状态</span><select value={form.status} onChange={event => setForm({...form, status: event.target.value as AdminPlaceInput['status']})} className={INPUT}>{Object.entries(PLACE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      </fieldset>
      <div className="sticky -bottom-6 flex justify-end gap-2 border-t border-slate-200 bg-white py-4">
        <button type="button" disabled={busy} onClick={() => void close()} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-50">{changedOnServer ? '完成并关闭' : '取消'}</button>
        <button type="submit" disabled={busy || loading || !ready || imageProcessing || (target.kind === 'submission' && version === null)} className="min-h-10 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? '保存处理中…' : imageProcessing ? '图片压缩中…' : savedId ? '保存修改' : target.kind === 'submission' ? '保存并通过审核' : '保存地点'}</button>
      </div>
    </form>}
    {loading && <button type="button" onClick={() => void close()} className="mt-3 min-h-10 text-sm underline">取消</button>}
  </dialog>;
}
