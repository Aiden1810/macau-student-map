'use client';

import {FormEvent, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

export default function LoginPage() {
  const tAuth = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const {error: signInError} = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setSubmitting(false);

    if (signInError) {
      setError(`${tAuth('loginFailed')}: ${signInError.message}`);
      return;
    }

    router.replace('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{tAuth('loginTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600">{tAuth('loginSubtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{tAuth('email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tAuth('emailPlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{tAuth('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tAuth('passwordPlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? tAuth('submitting') : tAuth('submit')}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

          <div className="mt-5 text-center text-sm">
            <Link href="/" locale={locale} className="font-medium text-slate-600 transition hover:text-slate-900">
              {tAuth('backHome')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
