'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale} from 'next-intl';
import {Star} from 'lucide-react';
import type {Session} from '@supabase/supabase-js';
import {ApiClientError, authenticatedApiRequest} from '@/lib/api/client';
import {supabase} from '@/lib/supabase';
import type {Review} from '@/lib/domain/review';
import ReviewDialog from './ReviewDialog';

type ReviewFormProps = {
  placeId: string;
  onSuccess?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
};
const buttonClass =
  'min-h-11 rounded-xl border border-line px-4 py-2 text-sm font-medium disabled:opacity-50';

export default function ReviewForm({
  placeId,
  onSuccess,
  onRefresh,
  onCancel,
  compact = false
}: ReviewFormProps) {
  const locale = useLocale();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const tokenRef = useRef<string | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const refreshRequested = useRef(false);
  const refreshCallback = useRef(onRefresh);

  useEffect(() => {
    refreshCallback.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const receiveSession = (session: Session | null) => {
      if (!active) return;
      tokenRef.current = session?.access_token ?? null;
      setUserId(session?.user.id ?? null);
    };
    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      receiveSession(session);
    });
    void supabase.auth
      .getSession()
      .then(({data}) => {
        if (!receivedEvent) receiveSession(data.session);
      })
      .catch(() => {
        if (!receivedEvent) receiveSession(null);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setMine(null);
    setRating(0);
    setContent('');
    setConfirmDelete(false);
    setMessage('');
    setError('');
    setLoadError('');
    setNeedsRefresh(false);
    if (userId === undefined) {
      setLoading(true);
      return;
    }
    const token = tokenRef.current;
    if (!userId || !token) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    void authenticatedApiRequest<{review: Review | null}>(`/api/places/${placeId}/reviews/mine`, token, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async ({review}) => {
        if (generation.current !== current) return;
        setMine(review);
        setEditing(!review || !!review.deletedAt);
        setRating(review && !review.deletedAt ? review.rating : 0);
        setContent(review && !review.deletedAt ? (review.content ?? '') : '');
        if (refreshRequested.current) {
          refreshRequested.current = false;
          try {
            await refreshCallback.current?.();
          } catch {
            if (generation.current === current)
              setError('评价已读取，列表刷新失败，请刷新页面查看最新评分。');
          }
        }
      })
      .catch(() => {
        if (generation.current === current) setLoadError('读取我的评价失败，请刷新后重试。');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (generation.current === current) setLoading(false);
      });
    return () => {
      generation.current = current + 1;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [placeId, userId, reload]);

  const refreshAfterSave = async (current: number) => {
    try {
      await onSuccess?.();
    } catch {
      if (generation.current === current) setMessage('评价已保存，列表刷新失败，请刷新页面查看最新评分。');
    }
  };
  const mutate = async (deleting = false) => {
    const token = tokenRef.current;
    if (!token || busyRef.current || needsRefresh || loading || loadError || (!deleting && !rating)) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    const current = generation.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const review = await authenticatedApiRequest<Review>(
        deleting ? `/api/reviews/${mine!.id}` : `/api/places/${placeId}/reviews`,
        token,
        {
          method: deleting ? 'DELETE' : 'POST',
          signal: controller.signal,
          body: JSON.stringify(
            deleting
              ? {expectedUpdatedAt: mine!.updatedAt}
              : {rating, content: content.trim() || null, expectedUpdatedAt: mine?.updatedAt ?? null}
          )
        }
      );
      if (generation.current !== current) return;
      setMine(review);
      setConfirmDelete(false);
      setEditing(deleting);
      if (deleting) {
        setRating(0);
        setContent('');
        setMessage('评价已删除，不再展示或计入评分。');
      } else
        setMessage(
          review.status === 'published' ? '评价已保存并展示。' : '评价已保存，待管理员重新审核后展示。'
        );
      await refreshAfterSave(current);
    } catch (failure) {
      if (generation.current !== current) return;
      setError(
        failure instanceof ApiClientError ? failure.message : '无法确认操作结果，请刷新核对后再重试。'
      );
      if (
        !(failure instanceof ApiClientError) ||
        ['CONFLICT', 'NETWORK_ERROR', 'INTERNAL_ERROR'].includes(failure.code)
      )
        setNeedsRefresh(true);
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;
      setBusy(false);
    }
  };
  const existing = mine && !mine.deletedAt;
  return (
    <section
      aria-label="我的评价"
      className={compact ? '' : 'rounded-2xl border border-line bg-white p-4 shadow-sm'}
    >
      <h2 className="text-base font-semibold text-ink">{existing ? '我的评价' : '发表评价'}</h2>
      {loading ? (
        <p role="status" className="mt-3 text-sm text-muted">
          正在读取我的评价…
        </p>
      ) : !userId ? (
        <div className="mt-3 text-sm text-muted">
          <p>登录后即可评分和发表评价。</p>
          <a
            href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/shop/${placeId}/review/new`)}`}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-pine-700 px-4 font-medium text-white"
          >
            登录后评价
          </a>
        </div>
      ) : loadError ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {loadError}
        </p>
      ) : (
        <>
          {existing && (
            <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
              <p className="font-medium text-ink">
                {mine.rating} 星 ·{' '}
                {mine.status === 'published'
                  ? mine.moderationStatus === 'approved'
                    ? '已通过审核'
                    : '已展示，待审核'
                  : mine.status === 'rejected'
                    ? '已隐藏'
                    : '已隐藏，待重新审核'}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-ink">
                {mine.content || '仅评分，未填写文字。'}
              </p>
              <p className="mt-2 text-xs text-muted">
                更新于 {new Date(mine.updatedAt).toLocaleString(locale)}
              </p>
              {mine.status !== 'published' && (
                <p className="mt-2 text-amber-900">
                  {mine.moderationReason ? `隐藏原因：${mine.moderationReason}。` : ''}
                  修改后需要管理员重新审核，通过后才会展示。
                </p>
              )}
            </div>
          )}
          {editing ? (
            <div className="mt-3">
              <fieldset disabled={busy || needsRefresh}>
                <legend className="text-sm text-muted">评分（必选）</legend>
                <div className="mt-1 flex gap-1" role="radiogroup" aria-label="评分">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} 星`}
                      onClick={() => setRating(star)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine-700"
                    >
                      <Star
                        aria-hidden="true"
                        className={`h-7 w-7 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-sm text-muted">
                  文字评价（选填，最多 3000 字）
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={compact ? 3 : 5}
                    maxLength={3000}
                    placeholder="写下你的真实体验……"
                    className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-pine-700"
                  />
                </label>
              </fieldset>
              <p className="mt-2 text-xs leading-5 text-muted">
                每个账号对一家店只保留一条评价。首次发布立即展示，管理员审核不通过后会隐藏。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !rating || needsRefresh}
                  onClick={() => void mutate()}
                  className={`${buttonClass} bg-pine-700 text-white`}
                >
                  {busy ? '保存中…' : existing ? '保存修改' : '发布评价'}
                </button>
                {existing && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setRating(mine.rating);
                      setContent(mine.content ?? '');
                    }}
                    className={buttonClass}
                  >
                    取消修改
                  </button>
                )}
              </div>
            </div>
          ) : (
            existing && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || needsRefresh}
                  onClick={() => setEditing(true)}
                  className={buttonClass}
                >
                  修改评价
                </button>
                <button
                  type="button"
                  disabled={busy || needsRefresh}
                  onClick={() => setConfirmDelete(true)}
                  className={`${buttonClass} text-rose-700`}
                >
                  删除评价
                </button>
              </div>
            )
          )}
          {confirmDelete && (
            <ReviewDialog title="确认删除评价" busy={busy} onCancel={() => setConfirmDelete(false)}>
              <p className="mt-3 text-sm text-rose-900">
                删除后不再展示，也不计入店铺评分；后台保留审核记录。
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  autoFocus
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className={buttonClass}
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void mutate(true)}
                  className={`${buttonClass} text-rose-700`}
                >
                  确认删除
                </button>
              </div>
            </ReviewDialog>
          )}
        </>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-pine-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {(loadError || needsRefresh) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            refreshRequested.current = true;
            setReload((value) => value + 1);
          }}
          className={`mt-3 ${buttonClass}`}
        >
          刷新我的评价
        </button>
      )}
      {onCancel && (
        <button type="button" disabled={busy} onClick={onCancel} className={`mt-3 ${buttonClass}`}>
          返回店铺
        </button>
      )}
    </section>
  );
}
