'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {readLocalSubmissions} from '@/lib/submissions/local';
import {supabase} from '@/lib/supabase';

type SubmissionStatus = 'pending' | 'verified' | 'rejected';

type SubmissionRow = {
  id: string;
  name: string;
  name_i18n?: Record<string, string> | null;
  status: SubmissionStatus;
  created_at?: string | null;
  source?: 'remote' | 'local';
  localServerId?: string | null;
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

      const {
        data: {user},
        error: userError
      } = await supabase.auth.getUser();

      if (cancelled) return;

      const localRecords = readLocalSubmissions();
      const localRows: SubmissionRow[] = localRecords.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        created_at: item.createdAt,
        source: 'local',
        localServerId: item.serverId ?? null
      }));

      if (userError || !user) {
        setSubmissions(localRows);
        setLoading(false);
        return;
      }

      const result = await supabase
        .from('shops')
        .select('id,name,name_i18n,status,created_at')
        .eq('submitted_by', user.id)
        .order('created_at', {ascending: false});

      if (cancelled) return;

      if (result.error) {
        const missingColumn = /submitted_by/i.test(result.error.message) && /does not exist/i.test(result.error.message);

        setError(
          missingColumn
            ? '投稿记录功能正在升级中，请稍后再试。'
            : result.error.message
        );
        setSubmissions(localRows);
        setLoading(false);
        return;
      }

      const remoteRows = ((result.data ?? []) as SubmissionRow[]).map((row) => ({
        ...row,
        source: 'remote' as const
      }));

      const remoteIdSet = new Set(remoteRows.map((row) => row.id));
      const dedupedLocalRows = localRows.filter((row) => !row.localServerId || !remoteIdSet.has(row.localServerId));

      const mergedRows = [...remoteRows, ...dedupedLocalRows].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setSubmissions(mergedRows);
      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return submissions.map((row) => {
      const localizedName = row.name_i18n?.[locale] || row.name_i18n?.['zh-CN'] || row.name;

      const statusLabel =
        row.status === 'verified'
          ? tContribute('statusVerified')
          : row.status === 'rejected'
            ? tContribute('statusRejected')
            : tContribute('statusPending');

      return {
        ...row,
        localizedName,
        statusLabel
      };
    });
  }, [locale, submissions, tContribute]);

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
                      <td className="px-4 py-3 text-sm text-slate-800">{row.localizedName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.statusLabel}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatTime(row.created_at)}</td>
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
