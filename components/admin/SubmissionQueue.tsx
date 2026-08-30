'use client';

import {useCallback, useEffect, useState} from 'react';
import {authenticatedApiRequest} from '@/lib/api/client';
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

export default function SubmissionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const accessToken = async () => {
    const {data} = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('管理员会话已过期，请重新登录。');
    return data.session.access_token;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const data = await authenticatedApiRequest<{items: QueueItem[]}>(
        '/api/admin/submissions',
        token
      );
      setItems(data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '审核队列加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : '审核操作失败。');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">规范投稿审核队列</h2>
          <p className="mt-1 text-sm text-slate-500">批准、合并、驳回均经过服务端权限校验和数据库事务函数。</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
          刷新
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading ? (
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
                <button disabled={busyId === item.id} onClick={() => void moderate(item, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">批准为新地点</button>
                <button disabled={busyId === item.id} onClick={() => void moderate(item, 'merge')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">合并到已有地点</button>
                <button disabled={busyId === item.id} onClick={() => void moderate(item, 'reject')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">驳回</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
