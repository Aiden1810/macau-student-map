'use client';

import {FormEvent, useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';

const ADMIN_EMAIL_WHITELIST = ['2772157757@qq.com'];

export default function AdminLoginPage() {
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

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    const {data: authData, error: authError} = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setSubmitting(false);
      setError('登录状态获取失败，请重试');
      return;
    }

    const {data: profile, error: profileError} = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    setSubmitting(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    const normalizedEmail = authData.user.email?.trim().toLowerCase() ?? '';
    const isWhitelisted = ADMIN_EMAIL_WHITELIST.includes(normalizedEmail);

    if (profile?.role !== 'admin' && !isWhitelisted) {
      await supabase.auth.signOut();
      setError('该账号没有管理员权限');
      return;
    }

    router.replace('/admin');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
