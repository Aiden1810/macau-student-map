
'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowLeft, MapPin, Navigation} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import {discover} from '@/lib/discovery/client';
import type {PoiMetadata} from '@/lib/discovery/business';
import {poiAsShop, type Poi} from '@/lib/discovery/search';
import {DiscoveryAccountProvider} from './DiscoveryAccount';
import DiscoveryFavorite, {useDiscoveryFavoriteFlags} from './DiscoveryFavorite';
import {RecommendationPanel} from './StudentRecommendations';
import {discoveryErrorKey} from './copy';

const action = 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-medium text-pine-800';

export default function DiscoveryDetail({poiId}: {poiId: string}) {
  return <DiscoveryAccountProvider><Detail poiId={poiId} /></DiscoveryAccountProvider>;
}

function Detail({poiId}: {poiId: string}) {
  const t = useTranslations('Discovery');
  const [poi, setPoi] = useState<Poi | null>(null);
  const [known, setKnown] = useState<PoiMetadata | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const favoriteState = useDiscoveryFavoriteFlags([poiId]);
  const returnPath = '/discover/poi/' + poiId;

  useEffect(() => {
    const controller = new AbortController();
    let meta: PoiMetadata | null = null;
    setLoading(true);
    setLookupFailed(false);
    setIssue(null);
    setPoi(null);
    void (async () => {
      try {
        const {data, error} = await supabase.rpc('discovery_poi_metadata', {p_ids: [poiId]})
          .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
        if (controller.signal.aborted) return;
        if (error) setLookupFailed(true);
        else meta = data?.[0] ?? null;
        setKnown(meta);
        if (meta && (!meta.available || !meta.current_poi_id)) {
          setIssue('placeUnavailable');
          return;
        }
        const {items} = await discover({kind: 'detail', id: meta?.current_poi_id ?? poiId}, controller.signal);
        if (controller.signal.aborted) return;
        setPoi(items[0] ?? null);
        if (!items.length) setIssue('placeUnavailable');
      } catch (error) {
        if (!controller.signal.aborted) setIssue(discoveryErrorKey(error instanceof DiscoveryError ? error.code : null));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [poiId, revision]);

  const nav = poi ? buildAmapNavigationUrl(poiAsShop(poi)) : null;

  return <main className="mx-auto max-w-3xl space-y-4 px-4 pb-10 pt-5 text-ink md:pt-8">
    <Link href="/discover" className={action}><ArrowLeft size={16} aria-hidden="true" />{t('title')}</Link>
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4 md:p-6">
      {loading && <p role="status" className="text-sm text-muted">{t('loading')}</p>}
      {lookupFailed && <p role="alert" className="text-sm text-amber-900">{t('catalogFailed')}</p>}
      {issue && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-900">
        {t(issue)} <button type="button" className={action} onClick={() => setRevision(old => old + 1)}>{t('retry')}</button>
      </div>}
      {poi && <>
        <h1 className="break-words text-2xl font-semibold">{poi.name}</h1>
        <p className="flex items-start gap-2 text-sm text-muted"><MapPin size={17} className="shrink-0 text-pine-700" aria-hidden="true" />
          {[poi.address, poi.category].filter(Boolean).join(' · ') || t('food')}
        </p>
        <p className="text-xs text-muted">{t('provider')}</p>
      </>}
      <div className="flex flex-wrap items-start gap-2">
        {nav && <a href={nav} className={action} target="_blank" rel="noopener noreferrer"><Navigation size={15} aria-hidden="true" />{t('navigate')}</a>}
        {(poi || known?.available || favoriteState.saved(poiId)) && <DiscoveryFavorite poiId={poiId} state={favoriteState} returnPath={returnPath} />}
        {known?.place_id && <Link href={'/shop/' + known.place_id} className={action}>{t('platformDetails')}</Link>}
      </div>
    </section>
    {(!loading && (poi || known?.available)) && <RecommendationPanel key={poiId} target={{poiId}} returnPath={returnPath} canSubmit={Boolean(poi)} />}
  </main>;
}
