
'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Heart} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {discoveryPost} from '@/lib/discovery/client';
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {useDiscoveryAccount} from './DiscoveryAccount';
import {discoveryErrorKey} from './copy';

const style = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium text-pine-800 disabled:opacity-60';

export function useDiscoveryFavoriteFlags(poiIds: string[]) {
  const session = useDiscoveryAccount();
  const accountId = session?.user.id;
  const key = [...new Set(poiIds)].sort().join('|');
  const [state, setState] = useState<{key: string; accountId: string; flags: string[]} | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!accountId || !key) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
    setError(false);
    void (async () => {
      try {
        const {data, error} = await supabase.rpc('my_discovery_favorites_for_pois', {p_ids: key.split('|')}).abortSignal(signal);
        if (error) throw error;
        if (!controller.signal.aborted) setState({key, accountId, flags: data ?? []});
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [accountId, key, revision]);
  const current = state?.key === key && state.accountId === accountId ? state : null;
  return {
    saved: (id: string) => current?.flags.includes(id) ?? false,
    ready: Boolean(current),
    error: Boolean(accountId && key && error),
    retry: () => setRevision(previous => previous + 1),
    update: (id: string, value: boolean) => {
      setState(previous => {
        if (!previous || previous.accountId !== accountId) return previous;
        const flags = previous.flags.filter(flag => flag !== id);
        if (value) flags.push(id);
        return {...previous, flags};
      });
      setRevision(previous => previous + 1);
    }
  };
}

export default function DiscoveryFavorite({poiId, returnPath, state, canSave}: {
  poiId: string; returnPath: string; canSave: boolean; state: ReturnType<typeof useDiscoveryFavoriteFlags>
}) {
  const t = useTranslations('Discovery');
  const locale = useLocale();
  const session = useDiscoveryAccount();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const accountId = session?.user.id;
  useEffect(() => {
    setSaving(false);
    setError(null);
    return () => {pending.current?.abort(); pending.current = null;};
  }, [accountId, poiId]);
  const saved = state.saved(poiId);
  // Existing saves can still be removed when new associations are disabled.
  if (!canSave && !saved && (session === null || state.ready)) return null;
  if (session === null) return <Link href={{pathname: '/login', query: {next: '/' + locale + returnPath}}} className={style}>
    <Heart size={15} aria-hidden="true" />{t('signInToSave')}
  </Link>;

  async function toggle() {
    if (!session || pending.current || !state.ready || (!canSave && !saved)) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError(null);
    try {
      const result = await discoveryPost<{saved: boolean}>('favorite', {poiId, saved: !saved}, {
        token: session.access_token, signal: controller.signal
      });
      if (!controller.signal.aborted) state.update(poiId, result.saved);
    } catch (failure) {
      if (!controller.signal.aborted) {
        state.retry();
        setError(discoveryErrorKey(failure instanceof DiscoveryError ? failure.code : null));
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSaving(false);
      }
    }
  }

  return <div>
    <button type="button" disabled={(!state.ready && !state.error) || saving} aria-pressed={saved} onClick={() => state.error ? state.retry() : void toggle()} className={style}>
      <Heart size={15} aria-hidden="true" className={saved ? 'fill-current' : ''} />{t(state.error ? 'retry' : saved ? 'saved' : 'save')}
    </button>
    {(error || state.error) && <p role="alert" className="mt-1 text-xs text-rose-700">{t(error ?? 'favoriteError')}</p>}
  </div>;
}
