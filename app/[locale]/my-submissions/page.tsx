'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {authenticatedApiRequest} from '@/lib/api/client';
import {supabase} from '@/lib/supabase';

type SubmissionStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'merged';

type SubmissionRow = {
  id: string;
  name: string;
  status: SubmissionStatus;
  categorySlug: 'food' | 'shopping' | 'entertainment' | 'service';
  createdAt: string;
  submittedAt: string | null;
  reviewNote: string | null;
};

function formatTime(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MySubmissionsPage() {
  const tContribute = useTranslations('Contribute');
  const tAuth = useTranslations('Auth');
  const locale = useLocale() as 'zh-CN' | 'zh-MO' | 'en';

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const {data, error: sessionError} = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !data.session?.access_token) {
        setError('请先登录后查看投稿记录。');
        setSubmissions([]);
        setLoading(false);
        return;
      }

      try {
        const result = await authenticatedApiRequest<{items: SubmissionRow[]}>(
          '/api/submissions',
          data.session.access_token
        );
        if (cancelled) return;
        setSubmissions(result.items);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : '投稿记录加载失败。');
        setSubmissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return submissions.map((row) => {
      const statusLabel =
        row.status === 'approved'
          ? tContribute('statusVerified')
          : row.status === 'rejected'
            ? tContribute('statusRejected')
            : row.status === 'merged'
              ? '已合并到现有地点'
              : row.status === 'draft'
                ? '草稿'
                : tContribute('statusPending');

      return {
        ...row,
        statusLabel
      };
    });
  }, [submissions, tContribute]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{tContribute('mySubmissionsTitle')}</h1>
              <p className="mt-1 text-sm text-slate-600">{tContribute('mySubmissionsSubtitle')}</p>
            </div>
            <Link href="/" locale={locale} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              {tAuth('backHome')}
            </Link>
          </div>

          {loading && <p className="text-sm text-slate-500">Loading...</p>}

          {!loading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-slate-600">{tContribute('mySubmissionsEmpty')}</p>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-slate-500">店名</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-slate-500">状态</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-slate-500">{tContribute('submittedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        <p>{row.name}</p>
                        {row.reviewNote && <p className="mt-1 text-xs text-slate-500">审核备注：{row.reviewNote}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.statusLabel}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatTime(row.submittedAt ?? row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
