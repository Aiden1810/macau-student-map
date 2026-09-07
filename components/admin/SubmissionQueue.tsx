'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {authenticatedApiRequest} from '@/lib/api/client';
import {createRequestGuard} from '@/lib/data/async-request';
import {createComponentLifecycleGuard} from '@/lib/data/component-lifecycle';
import {supabase} from '@/lib/supabase';

type QueueItem = {
  id: string;
  name: string;
  address: string | null;
  categorySlug: string;
  tagIds: string[];
  notes: string | null;
  submittedAt: string | null;
};

type QueueStats = {
  pending: number;
  approved: number;
  merged: number;
  rejected: number;
};

type QueueResponse = {
  items: QueueItem[];
  stats: QueueStats;
};

type LoadingKind = 'initial' | 'refresh' | null;

export default function SubmissionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loadingKind, setLoadingKind] = useState<LoadingKind>('initial');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const requestGuardRef = useRef(createRequestGuard());
  const lifecycleGuardRef = useRef(createComponentLifecycleGuard());

  const accessToken = async () => {
    const {data} = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('管理员会话已过期，请重新登录。');
    return data.session.access_token;
  };

  const load = useCallback(async (kind: Exclude<LoadingKind, null>) => {
    if (!lifecycleGuardRef.current.isActive()) return;
    const requestToken = requestGuardRef.current.begin();
    setLoadingKind(kind);
    setError(null);
    try {
      const token = await accessToken();
      if (!lifecycleGuardRef.current.isActive()) return;
      const data = await authenticatedApiRequest<QueueResponse>(
        '/api/admin/submissions',
        token,
        {cache: 'no-store'}
      );
      if (
        !lifecycleGuardRef.current.isActive() ||
        !requestGuardRef.current.isCurrent(requestToken)
      ) return;
      setItems(data.items);
      setStats(data.stats);
    } catch (loadError) {
      if (
        !lifecycleGuardRef.current.isActive() ||
        !requestGuardRef.current.isCurrent(requestToken)
      ) return;
      setError(loadError instanceof Error ? loadError.message : '审核队列加载失败。');
    } finally {
      if (
        lifecycleGuardRef.current.isActive() &&
        requestGuardRef.current.isCurrent(requestToken)
      ) {
        setLoadingKind(null);
      }
    }
  }, []);

  useEffect(() => {
    lifecycleGuardRef.current.activate();
    void load('initial');
    const requestGuard = requestGuardRef.current;
    const lifecycleGuard = lifecycleGuardRef.current;
    return () => {
      lifecycleGuard.deactivate();
      requestGuard.invalidate();
    };
  }, [load]);

  const moderate = async (item: QueueItem, action: 'approve' | 'merge' | 'reject') => {
    const reviewNote = notes[item.id]?.trim() || null;
    if (action === 'reject' && (!reviewNote || reviewNote.length < 3)) {
      setError('驳回时必须填写至少 3 个字的理由。');
      return;
    }
    if (action === 'merge' && !mergeTargets[item.id]?.trim()) {
      setError('合并时必须填写目标地点 UUID。');
      return;
    }
    if (!lifecycleGuardRef.current.tryBeginExclusive()) return;

    setBusyId(item.id);
    setError(null);
    try {
      const token = await accessToken();
      const body =
        action === 'merge'
          ? {targetPlaceId: mergeTargets[item.id].trim(), reviewNote}
          : {reviewNote};
      await authenticatedApiRequest(
        `/api/admin/submissions/${item.id}/${action}`,
        token,
        {method: 'POST', body: JSON.stringify(body)}
      );
      if (!lifecycleGuardRef.current.isActive()) return;
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      await load('refresh');
    } catch (moderationError) {
      if (lifecycleGuardRef.current.isActive()) {
        setError(moderationError instanceof Error ? moderationError.message : '审核操作失败。');
      }
    } finally {
      lifecycleGuardRef.current.finishExclusive();
      if (lifecycleGuardRef.current.isActive()) setBusyId(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">规范投稿审核队列</h2>
          <p className="mt-1 text-sm text-slate-500">批准、合并、驳回均经过服务端权限校验和数据库事务函数。</p>
        </div>
        <button
          type="button"
          onClick={() => void load('refresh')}
          disabled={loadingKind !== null || busyId !== null}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingKind === 'refresh' ? '刷新中…' : '刷新'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">待审核：{stats?.pending ?? '—'}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">已批准：{stats?.approved ?? '—'}</span>
        <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">已合并：{stats?.merged ?? '—'}</span>
        <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">已驳回：{stats?.rejected ?? '—'}</span>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loadingKind === 'initial' ? (
        <p className="mt-4 text-sm text-slate-500">加载审核队列中……</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">当前没有待审核投稿。</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.address || '未填写地址'} · {item.categorySlug}</p>
                  <p className="mt-1 break-all text-[11px] text-slate-400">{item.id}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{item.tagIds.length} 个标签</span>
              </div>
              <textarea
                value={notes[item.id] ?? ''}
                onChange={(event) => setNotes((current) => ({...current, [item.id]: event.target.value}))}
                rows={2}
                placeholder="审核备注；驳回时必填"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={mergeTargets[item.id] ?? ''}
                onChange={(event) => setMergeTargets((current) => ({...current, [item.id]: event.target.value}))}
                placeholder="仅合并时填写：现有地点 UUID"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busyId !== null} onClick={() => void moderate(item, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">批准为新地点</button>
                <button disabled={busyId !== null} onClick={() => void moderate(item, 'merge')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">合并到已有地点</button>
                <button disabled={busyId !== null} onClick={() => void moderate(item, 'reject')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">驳回</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
