'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

export default function AuthCallbackPage() {
  const tAuth = useTranslations('Auth');
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const hashParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    return new URLSearchParams(hash);
  }, []);

  useEffect(() => {
    const run = async () => {
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setError(tAuth('callbackMissingToken'));
        return;
      }

      const {error: sessionError} = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (sessionError) {
        setError(`${tAuth('callbackFailed')}: ${sessionError.message}`);
        return;
      }

      router.replace('/');
      router.refresh();
    };

    run();
  }, [hashParams, router, tAuth]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{tAuth('callbackTitle')}</h1>
          {!error ? (
            <p className="mt-2 text-sm text-slate-600">{tAuth('callbackLoading')}</p>
          ) : (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          )}
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="mt-5 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {tAuth('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
