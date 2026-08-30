'use client';

import {useState} from 'react';
import {Star} from 'lucide-react';
import {authenticatedApiRequest} from '@/lib/api/client';
import {supabase} from '@/lib/supabase';

type ReviewFormProps = {
  placeId: string;
  onSuccess?: () => void | Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
};

export default function ReviewForm({placeId, onSuccess, onCancel, compact = false}: ReviewFormProps) {
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!placeId || rating === 0 || submitting) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const {data, error: sessionError} = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error('请先登录后再发表评论。');
      }
      await authenticatedApiRequest(`/api/places/${placeId}/reviews`, data.session.access_token, {
        method: 'POST',
        body: JSON.stringify({rating, content: content.trim() || null})
      });
      setMessage('评价已发布；再次提交会更新你对该地点的评价。');
      await onSuccess?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '评价发布失败。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={compact ? '' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'}>
      <h2 className="text-base font-semibold text-slate-900">发表评价</h2>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="评分">
        {([1, 2, 3, 4, 5] as const).map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} 星`}
            onClick={() => setRating(star)}
            className="rounded-md p-1 outline-none ring-emerald-600 transition hover:scale-110 focus-visible:ring-2"
          >
            <Star className={`h-7 w-7 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={compact ? 3 : 5}
        maxLength={3000}
        placeholder="可选：写下你的真实体验……"
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || rating === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '发布中……' : '发布评价'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            返回
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
