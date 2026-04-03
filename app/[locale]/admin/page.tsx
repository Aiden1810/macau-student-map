'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

type PendingShop = {
  id: string;
  name: string;
  category: string | null;
  tags: string[] | null;
  student_discount: string | null;
  status: string | null;
  created_at?: string | null;
};

const ADMIN_SECRET_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? 'cityu2026';

type BusyAction = {
  shopId: string;
  action: 'approve' | 'softDelete';
} | null;

export default function AdminModerationPage() {
  const t = useTranslations('Admin');
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<PendingShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const isWritable = searchParams.get('key') === ADMIN_SECRET_KEY;

  const fetchPendingShops = useCallback(async () => {
    if (!isWritable) {
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const {data, error: fetchError} = await supabase
      .from('shops')
      .select('id, name, category, tags, student_discount, status, created_at')
      .eq('status', 'pending')
      .order('created_at', {ascending: true});

    if (fetchError) {
      setError(fetchError.message);
      setShops([]);
      setLoading(false);
      return;
    }

    setShops((data ?? []).map((row) => ({...row, id: String(row.id)})));
    setLoading(false);
  }, [isWritable]);

  useEffect(() => {
    fetchPendingShops();
  }, [fetchPendingShops]);

  const pendingCount = useMemo(() => shops.length, [shops]);

  const approveShop = async (shopId: string) => {
    if (!isWritable || busyAction) return;

    setBusyAction({shopId, action: 'approve'});
    setError(null);

    const {error: updateError} = await supabase
      .from('shops')
      .update({status: 'approved'})
      .eq('id', shopId);

    if (updateError) {
      setError(updateError.message);
      setBusyAction(null);
      return;
    }

    setShops((prev) => prev.filter((shop) => shop.id !== shopId));
    setBusyAction(null);
  };

  const softDeleteShop = async (shopId: string) => {
    if (!isWritable || busyAction) return;

    setBusyAction({shopId, action: 'softDelete'});
    setError(null);

    const {error: updateError} = await supabase
      .from('shops')
      .update({status: 'rejected'})
      .eq('id', shopId);

    if (updateError) {
      setError(updateError.message);
      setBusyAction(null);
      return;
    }

    setShops((prev) => prev.filter((shop) => shop.id !== shopId));
    setBusyAction(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">{t('badge')}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('title')}</h1>
              <p className="mt-2 text-sm text-slate-600">{t('subtitle')}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                {t('pendingCount', {count: pendingCount})}
              </span>
              <Link
                href="/"
                className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {t('backHome')}
              </Link>
            </div>
          </div>

          {!isWritable && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('readOnlyMode')}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t('errorPrefix')}: {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            {t('loading')}
          </div>
        ) : shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            {t('empty')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shops.map((shop) => {
              const isApproving = busyAction?.shopId === shop.id && busyAction.action === 'approve';
              const isSoftDeleting = busyAction?.shopId === shop.id && busyAction.action === 'softDelete';
              const isBusy = busyAction?.shopId === shop.id;

              return (
                <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{shop.name || t('unnamed')}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        ID: <span className="font-mono">{shop.id}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {shop.status ?? 'pending'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">{t('type')}:</span> {shop.category ?? '-'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">{t('discount')}:</span>{' '}
                      {shop.student_discount ?? '-'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">{t('tags')}:</span>{' '}
                      {shop.tags?.length ? shop.tags.join(', ') : '-'}
                    </p>
                  </div>

                  {isWritable ? (
                    <div className="mt-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => approveShop(shop.id)}
                        disabled={isBusy}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isApproving ? t('processing') : t('approve')}
                      </button>

                      <button
                        type="button"
                        onClick={() => softDeleteShop(shop.id)}
                        disabled={isBusy}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSoftDeleting ? t('processing') : t('softDelete')}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                      {t('readOnlyCardHint')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
