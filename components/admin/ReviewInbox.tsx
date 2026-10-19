'use client';

import {useEffect, useRef, useState} from 'react';
import {adminEditorRequest} from './PlaceEditor';
import {ApiClientError} from '@/lib/api/client';
import {REVIEW_PAGE_SIZE, type Review} from '@/lib/domain/review';
import ReviewDialog from '../reviews/ReviewDialog';

type AdminReview = Review & {placeName: string};
type Result = {items: AdminReview[]; total: number; page: number};
type Filter = 'pending' | 'approved' | 'rejected' | 'deleted' | 'all';
const filters = [
  ['pending', '待审核'],
  ['approved', '已通过'],
  ['rejected', '未通过'],
  ['deleted', '用户已删除'],
  ['all', '全部']
] as const;
const buttonClass =
  'min-h-11 rounded-xl border border-line px-3 py-2 text-sm font-medium disabled:opacity-50';
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', {timeZone: 'Asia/Macau'});

export default function ReviewInbox() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    review: AdminReview;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [reason, setReason] = useState('');
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      mutation.current?.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError('');
    setNeedsRefresh(false);
    setConfirmation(null);
    void adminEditorRequest<Result>(`/api/admin/reviews?status=${filter}&page=${page}`, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then((result) => {
        if (!active) return;
        const last = Math.max(0, Math.ceil(result.total / REVIEW_PAGE_SIZE) - 1);
        if (page > last) setPage(last);
        else setData(result);
      })
      .catch((failure) => {
        if (active) {
          setData(null);
          setError(
            failure instanceof ApiClientError && failure.code === 'SCHEMA_UNAVAILABLE'
              ? '评价审核尚未启用，需要先安装本次评价数据库迁移。'
              : '读取评价失败，请刷新重试。'
          );
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filter, page, reload]);
  const decide = async () => {
    if (!confirmation || busyRef.current || needsRefresh) return;
    if (confirmation.decision === 'rejected' && reason.trim().length < 3) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const controller = new AbortController();
    mutation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      await adminEditorRequest(`/api/admin/reviews/${confirmation.review.id}`, {
        method: 'PATCH',
        signal: controller.signal,
        body: JSON.stringify({
          decision: confirmation.decision,
          reason: confirmation.decision === 'rejected' ? reason.trim() : null,
          expectedUpdatedAt: confirmation.review.updatedAt
        })
      });
      if (mounted.current) {
        setNotice(
          confirmation.decision === 'approved'
            ? '已通过审核，评价继续展示并计入评分。'
            : '已隐藏评价，并从店铺评分中排除。'
        );
        setConfirmation(null);
        setReload((value) => value + 1);
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure instanceof ApiClientError ? failure.message : '无法确认审核结果，请先刷新核对。');
        setNeedsRefresh(true);
        setConfirmation(null);
      }
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section aria-label="用户评价管理" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">用户评价</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            评价首次发布立即展示。审核不通过后隐藏，同时移除对应分数；被隐藏内容修改后需要重新审核。低评分本身不构成隐藏理由。
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => setReload((value) => value + 1)}
          className={buttonClass}
        >
          刷新
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={filter === key}
            disabled={busy}
            onClick={() => {
              setFilter(key);
              setPage(0);
              setNotice('');
            }}
            className={`${buttonClass} ${filter === key ? 'bg-pine-700 text-white' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="mt-4 text-sm text-pine-700">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-10 text-center text-sm text-muted">
          正在读取评价…
        </p>
      ) : !data?.items.length && !error ? (
        <p className="py-10 text-center text-sm text-muted">当前没有符合条件的评价。</p>
      ) : (
        <div className="mt-5 space-y-4">
          {data?.items.map((item) => (
            <article key={item.id} className="min-w-0 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="break-words font-semibold text-ink">{item.placeName}</h3>
                <span className="rounded-full bg-canvas px-3 py-1 text-xs text-muted">
                  {item.deletedAt ? '用户已删除' : item.status === 'published' ? '已展示' : '已隐藏'} ·{' '}
                  {item.moderationStatus === 'pending'
                    ? '待审核'
                    : item.moderationStatus === 'approved'
                      ? '已通过'
                      : '未通过'}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-ink">{item.rating} / 5 星</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-ink">
                {item.content || '用户仅评分，未填写文字。'}
              </p>
              <p className="mt-3 break-all text-xs leading-6 text-muted">
                用户编号：{item.userId}
                <br />
                发布：{formatTime(item.createdAt)} · 更新：{formatTime(item.updatedAt)}
              </p>
              {item.moderationReason && (
                <p className="mt-2 break-words text-sm text-amber-900">隐藏原因：{item.moderationReason}</p>
              )}
              {!item.deletedAt && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || needsRefresh || item.moderationStatus === 'approved'}
                    onClick={() => {
                      setConfirmation({review: item, decision: 'approved'});
                      setReason('');
                    }}
                    className={`${buttonClass} text-pine-700`}
                  >
                    审核通过
                  </button>
                  <button
                    type="button"
                    disabled={busy || needsRefresh || item.moderationStatus === 'rejected'}
                    onClick={() => {
                      setConfirmation({review: item, decision: 'rejected'});
                      setReason('');
                    }}
                    className={`${buttonClass} text-rose-700`}
                  >
                    隐藏评价
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {confirmation && (
        <ReviewDialog
          title={`${confirmation.decision === 'rejected' ? '隐藏评价' : '通过审核'} · ${confirmation.review.placeName}`}
          busy={busy}
          onCancel={() => setConfirmation(null)}
        >
          <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted">
            {confirmation.review.rating} 星 · {confirmation.review.content || '仅评分'}
          </p>
          {confirmation.decision === 'rejected' ? (
            <label className="mt-4 block text-sm text-ink">
              隐藏原因（至少 3 字，将向作者展示）
              <textarea
                autoFocus
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                className="mt-2 w-full rounded-xl border border-line p-3"
                rows={3}
              />
            </label>
          ) : (
            <p className="mt-3 text-sm text-muted">通过后公开展示，并计入店铺评分。</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmation(null)}
              className={buttonClass}
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || (confirmation.decision === 'rejected' && reason.trim().length < 3)}
              onClick={() => void decide()}
              className={`${buttonClass} bg-pine-700 text-white`}
            >
              {busy ? '处理中…' : confirmation.decision === 'rejected' ? '确认隐藏' : '确认通过'}
            </button>
          </div>
        </ReviewDialog>
      )}
      {data && !loading && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>
            共 {data.total} 条 · 第 {page + 1} / {Math.max(1, Math.ceil(data.total / REVIEW_PAGE_SIZE))} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || page === 0}
              onClick={() => setPage((value) => value - 1)}
              className={buttonClass}
            >
              上一页
            </button>
            <button
              type="button"
              disabled={busy || (page + 1) * REVIEW_PAGE_SIZE >= data.total}
              onClick={() => setPage((value) => value + 1)}
              className={buttonClass}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
