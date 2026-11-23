
'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {discover} from '@/lib/discovery/client';
import type {FavoriteRow} from '@/lib/discovery/business';
import {DiscoveryAccountProvider, useDiscoveryAccount} from './DiscoveryAccount';

const action = 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-medium text-pine-800 disabled:opacity-60';
type Saved = FavoriteRow & {name?: string};

export default function DiscoveryFavoritesPage() {
  return <DiscoveryAccountProvider><SavedShops /></DiscoveryAccountProvider>;
}

function SavedShops() {
  const t = useTranslations('Discovery');
  const locale = useLocale();
  const session = useDiscoveryAccount();
  const account = session?.user.id;
  return <main className="mx-auto max-w-3xl space-y-4 px-4 pb-10 pt-5 text-ink md:pt-8">
    <Link href="/discover" className={action}><ArrowLeft size={16} aria-hidden="true" />{t('title')}</Link>
    <h1 className="text-xl font-semibold">{t('favorites')}</h1>
    {session === undefined && <p role="status">{t('loading')}</p>}
    {session === null && <Link href={{pathname: '/login', query: {next: '/' + locale + '/discover/favorites'}}} className={action}>{t('signInToSave')}</Link>}
    {account && <SavedList key={account} />}
  </main>;
}

function SavedList() {
  const t = useTranslations('Discovery');
  const [after, setAfter] = useState<Saved | null>(null);
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(19000)]);
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const {data, error} = await supabase.rpc('list_my_discovery_favorites', {
          p_before: after?.created_at ?? null, p_before_id: after?.location_id ?? null
        }).abortSignal(signal);
        if (error) throw error;
        const rows = (data ?? []) as FavoriteRow[];
        const page = rows.slice(0, 10);
        const placeIds = page.flatMap(row => row.place_id ? [row.place_id] : []);
        const poiIds = page.flatMap(row => !row.place_id && row.poi_id ? [row.poi_id] : []);
        const [places, pois] = await Promise.allSettled([
          placeIds.length ? supabase.from('places').select('id,name').in('id', placeIds).eq('status', 'published').abortSignal(signal) : null,
          poiIds.length ? discover({kind: 'details', ids: poiIds}, signal) : null
        ]);
        if (controller.signal.aborted) return;
        const placeNames = new Map(places.status === 'fulfilled' ? places.value?.data?.map(item => [item.id, item.name]) : []);
        const poiNames = new Map(pois.status === 'fulfilled' ? pois.value?.items.map(item => [item.id, item.name]) : []);
        setPartial(pois.status === 'rejected' || places.status === 'rejected' || Boolean(places.value?.error));
        const next = page.map(row => ({...row, name: row.place_id ? placeNames.get(row.place_id) : row.poi_id ? poiNames.get(row.poi_id) : undefined}));
        setItems(previous => after ? [...previous, ...next] : next);
        setMore(rows.length > 10);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [after, revision]);

  return <section className="space-y-2">
    {loading && <p role="status" className="text-sm text-muted">{t('loading')}</p>}
    {error && <div role="alert" className="flex items-center gap-2 text-sm text-rose-700">{t('favoriteError')}
      <button type="button" className={action} onClick={() => setRevision(old => old + 1)}>{t('retry')}</button>
    </div>}
    {partial && <p role="status" className="text-sm text-amber-900">{t('favoritePartial')}</p>}
    {!loading && !error && !items.length && <p className="text-sm text-muted">{t('noFavorites')}</p>}
    {items.map(item => {
      const name = item.name || (item.poi_id ? 'POI ' + item.poi_id : t('placeUnavailable'));
      const href = item.place_id ? '/shop/' + item.place_id : item.poi_id ? '/discover/poi/' + item.poi_id : null;
      return <article key={item.location_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
        <p className="font-medium">{name}</p>
        {href && <Link href={href} className={action}>{t('details')}</Link>}
      </article>;
    })}
    {more && <button type="button" className={action} disabled={loading || error} onClick={() => setAfter(items.at(-1) ?? null)}>{t('more')}</button>}
  </section>;
}
