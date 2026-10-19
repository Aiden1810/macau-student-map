'use client';

import {useEffect, useRef, useState} from 'react';
import {CheckCircle2, Inbox, RefreshCw} from 'lucide-react';
import {adminEditorRequest} from './PlaceEditor';
import {FEEDBACK_CATEGORIES, FEEDBACK_PAGE_SIZE, type FeedbackFilter, type FeedbackRecord} from '@/lib/contact/feedback';
import {ApiClientError} from '@/lib/api/client';
import {contactCopy} from '@/lib/contact/copy';

export type FeedbackStats = {pending: number; resolved: number};
type InboxResponse = {items: FeedbackRecord[]; total: number; page: number; stats: FeedbackStats};

function formatTime(time: string) {
  return new Date(time).toLocaleString('zh-CN', {timeZone: 'Asia/Macau', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});
}

export default function FeedbackInbox({onStatsChange}: {onStatsChange?: (stats: FeedbackStats | null) => void}) {
  const [filter, setFilter] = useState<FeedbackFilter>('pending');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const mutationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {mountedRef.current = false; mutationControllerRef.current?.abort();};
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true); setError('');
    void adminEditorRequest<InboxResponse>(`/api/admin/feedback?status=${filter}&page=${page}`, {cache: 'no-store', signal: controller.signal})
      .then(result => {
        if (!active) return;
        const lastPage = Math.max(0, Math.ceil(result.total / FEEDBACK_PAGE_SIZE) - 1);
        if (page > lastPage) setPage(lastPage);
        else setData(result);
      })
      .catch(loadError => {
        if (!active) return;
        setData(null);
        setError(loadError instanceof ApiClientError && loadError.code === 'SCHEMA_UNAVAILABLE' ? '反馈收件箱尚未启用，需先完成反馈表配置。' : '读取反馈失败，请点击刷新重试。');
      }).finally(() => {window.clearTimeout(timeout); if (active) setLoading(false);});
    return () => {active = false; window.clearTimeout(timeout); controller.abort();};
  }, [filter, page, reload]);
  useEffect(() => {onStatsChange?.(loading || error ? null : data?.stats ?? null);}, [data, loading, error, onStatsChange]);

  const handleStatus = async (item: FeedbackRecord) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusyId(item.id); setError(''); setNotice('');
    const controller = new AbortController(); mutationControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const status = item.status === 'pending' ? 'resolved' : 'pending';
      await adminEditorRequest(`/api/admin/feedback/${item.id}`, {method: 'PATCH', signal: controller.signal, body: JSON.stringify({status, expectedStatus: item.status})});
      if (mountedRef.current) {
        setNotice(status === 'resolved' ? '已标记为已处理。' : '已移回待处理。');
        if (data?.items.length === 1 && page > 0 && filter !== 'all') setPage(value => value - 1);
        else setReload(value => value + 1);
      }
    } catch (updateError) {
      if (mountedRef.current) setError(updateError instanceof ApiClientError && updateError.code === 'CONFLICT' ? '这条反馈已被更新，请刷新后查看。' : '暂时无法确认处理结果，请先刷新查看，再决定是否重试。');
    } finally {window.clearTimeout(timeout); busyRef.current = false; if (mountedRef.current) setBusyId(null);}
  };

  return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-label="用户反馈收件箱">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-ink">用户反馈</h2><p className="mt-2 text-sm leading-6 text-muted">查看用户提交的问题、纠错、投诉和建议，处理后做个标记。</p></div><button type="button" disabled={loading || busyId !== null} onClick={() => setReload(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新</button></div>
    <div className="mt-5 flex flex-wrap gap-2">{([{key: 'pending', label: '待处理', count: data?.stats.pending}, {key: 'resolved', label: '已处理', count: data?.stats.resolved}, {key: 'all', label: '全部', count: data ? data.stats.pending + data.stats.resolved : undefined}] as const).map(item => <button key={item.key} type="button" disabled={busyId !== null} aria-pressed={filter === item.key} onClick={() => {setFilter(item.key); setPage(0); setNotice('');}} className={`min-h-11 rounded-xl px-4 text-sm font-medium disabled:opacity-50 ${filter === item.key ? 'bg-pine-700 text-white' : 'bg-canvas text-muted'}`}>{item.label} <span className="ml-1 tabular-nums">{error || loading ? '—' : item.count ?? '—'}</span></button>)}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    <p role="status" className="mt-3 text-sm text-pine-700">{notice}</p>
    {loading ? <p role="status" className="py-10 text-center text-sm text-muted">正在读取反馈…</p> : !error && data?.items.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-muted"><Inbox size={28} /><p className="text-sm">{filter === 'pending' ? '当前没有待处理的反馈。' : '当前筛选下没有反馈。'}</p></div> : <div className="mt-4 space-y-4">{data?.items.map(item => <article key={item.id} className="rounded-2xl border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{contactCopy('zh-CN').categories[FEEDBACK_CATEGORIES.indexOf(item.category)]}</h3><span className={`rounded-full px-2 py-1 text-xs ${item.status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-pine-50 text-pine-700'}`}>{item.status === 'pending' ? '待处理' : '已处理'}</span></div><time dateTime={item.created_at} className="text-xs text-muted">{formatTime(item.created_at)}</time></div>
      {item.place && <p className="mt-3 break-words text-sm text-muted">相关店铺或页面：{item.place}</p>}
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink">{item.message}</p>
      {item.reply_to && <p className="mt-3 break-all rounded-xl bg-canvas p-3 text-sm text-muted">用户提供的回复方式：{item.reply_to}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-all font-mono text-[11px] text-muted">编号 {item.id}</p><button type="button" onClick={() => void handleStatus(item)} disabled={busyId !== null || loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-pine-200 px-3 text-sm font-medium text-pine-700 disabled:opacity-50"><CheckCircle2 size={16} />{busyId === item.id ? '保存中…' : item.status === 'pending' ? '标记已处理' : '移回待处理'}</button></div>
      {item.handled_at && <p className="mt-2 text-xs text-muted">处理时间：{formatTime(item.handled_at)}</p>}
    </article>)}</div>}
    {data && !error && !loading && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"><span>共 {data.total} 条 · 第 {page + 1} / {Math.max(1, Math.ceil(data.total / FEEDBACK_PAGE_SIZE))} 页</span><div className="flex gap-2"><button type="button" disabled={page === 0 || busyId !== null} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-xl border border-line px-3 disabled:opacity-40">上一页</button><button type="button" disabled={(page + 1) * FEEDBACK_PAGE_SIZE >= data.total || busyId !== null} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-xl border border-line px-3 disabled:opacity-40">下一页</button></div></div>}
  </section>;
}
