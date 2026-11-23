
'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowLeft, LocateFixed, MapPin, Search, Star} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import MapPlaceholder from '@/components/MapPlaceholder';
import {mergeDiscoveryEntries, type DiscoveryEntry} from '@/lib/discovery/catalog';
import {discoveryQuery, distanceMeters, type Bounds, type Coordinates} from '@/lib/discovery/search';
import {useDiscoverySearch} from '@/lib/hooks/useDiscoverySearch';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import DiscoveryFavorite, {useDiscoveryFavoriteFlags} from './DiscoveryFavorite';
import {useFavorites} from '@/lib/hooks/useFavorites';
import {DiscoveryAccountProvider} from './DiscoveryAccount';
import {discoveryErrorKey} from './copy';

const startBounds: Bounds = [113.52, 22.11, 113.61, 22.23];
const control = 'min-h-11 rounded-xl border border-line bg-white px-3 text-sm';
const button = control + ' font-medium text-pine-800 disabled:opacity-50';

export default function DiscoveryMap({canPersistPoi}: {canPersistPoi: boolean}) {
  return <DiscoveryAccountProvider><DiscoveryBrowser canPersistPoi={canPersistPoi} /></DiscoveryAccountProvider>;
}

function DiscoveryBrowser({canPersistPoi}: {canPersistPoi: boolean}) {
  const t = useTranslations('Discovery');
  const {result, loading, error, catalogError, load, nextPage, retry} = useDiscoverySearch();
  const legacyFavorites = useFavorites();
  const [city, setCity] = useState('');
  const [keyword, setKeyword] = useState('');
  const [radius, setRadius] = useState<1000 | 3000 | 5000>(1000);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [mapError, setMapError] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusCoordinates, setFocusCoordinates] = useState<Coordinates | null>(null);
  const [locateSignal, setLocateSignal] = useState(0);
  const [mapVersion, setMapVersion] = useState(0);
  const initiated = useRef(false);
  const hasRequested = useRef(false);
  const entryNodes = useRef(new Map<string, HTMLElement>());

  const entries = useMemo(() => mergeDiscoveryEntries(
    result.pois, result.catalog, result.metadata, result.scope, recommendedOnly
  ), [result, recommendedOnly]);
  const searchFailed = Boolean(error || catalogError || result.metadataError);
  const shops = useMemo(() => entries.map(entry => entry.shop), [entries]);
  const favoriteState = useDiscoveryFavoriteFlags(result.pois.map(poi => poi.id));
  const selected = shops.some(shop => shop.id === selectedId) ? selectedId : null;

  const handleBounds = useCallback((next: Bounds) => setBounds(next.map(value => Number(value.toFixed(6))) as Bounds), []);
  const showMapError = useCallback(() => setMapError(true), []);
  const clearPosition = useCallback(() => setPosition(null), []);
  const start = useCallback(async (value: unknown) => {
    hasRequested.current = true;
    const parsed = discoveryQuery.safeParse(value);
    if (!parsed.success || parsed.data.kind === 'detail' || parsed.data.kind === 'details') {
      setInputError(value && typeof value === 'object' && 'kind' in value && value.kind === 'viewport' ? 'viewportInvalid' : 'searchInvalid');
      return;
    }
    setInputError(null);
    setSelectedId(null);
    const scope = await load(parsed.data);
    if (scope?.kind === 'around') setFocusCoordinates(scope.center);
  }, [load]);

  useEffect(() => {
    if (!bounds && !mapError) return;
    if (initiated.current || hasRequested.current) return;
    // Schedule after mount so Strict Mode cleanup cannot abort our only initial search.
    const timer = setTimeout(() => {
      initiated.current = true;
      if (!hasRequested.current) void start({kind: 'viewport', bounds: bounds ?? startBounds});
    }, 0);
    return () => clearTimeout(timer);
  }, [bounds, mapError, start]);

  useEffect(() => {
    if (result.scope?.kind !== 'text') return;
    const first = result.pois[0]?.coordinates ?? (result.catalog[0]
      ? [result.catalog[0].longitude, result.catalog[0].latitude] as Coordinates : null);
    if (first) setFocusCoordinates(previous => previous?.[0] === first[0] && previous[1] === first[1] ? previous : first);
  }, [result.scope, result.pois, result.catalog]);

  const searchText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void start({kind: 'text', city: city.trim() || undefined, keyword: keyword.trim() || undefined});
  };

  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    entryNodes.current.get(id)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 pb-10 pt-4 text-ink md:px-8 md:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={button + ' inline-flex items-center gap-2'}><ArrowLeft size={16} />{t('back')}</Link>
        <h1 className="text-xl font-semibold md:text-2xl">{t('title')}</h1>
        <Link href="/discover/favorites" className={button + ' inline-flex items-center'}>{t('favorites')}</Link>
      </header>

      <form onSubmit={searchText} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-pine-50 p-3 sm:flex sm:flex-wrap">
        <label className="min-w-0 flex-1 text-sm font-medium">{t('city')}
          <input maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder={t('cityHint')} className={'mt-1 w-full ' + control} />
        </label>
        <label className="min-w-0 flex-[2] text-sm font-medium">{t('keyword')}
          <input maxLength={80} value={keyword} onChange={event => setKeyword(event.target.value)} placeholder={t('keywordHint')} className={'mt-1 w-full ' + control} />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-pine-800 px-4 text-sm font-medium text-white"><Search size={16} />{t('search')}</button>
        <button type="button" disabled={!city.trim() || !keyword.trim()} className={button + ' self-end'} onClick={() => void start({kind: 'area', city: city.trim(), address: keyword.trim()})}>{t('searchStreet')}</button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!recommendedOnly} onClick={() => setRecommendedOnly(false)} className={button + (!recommendedOnly ? ' bg-pine-50 ring-1 ring-pine-700' : '')}>{t('all')}</button>
        <button type="button" aria-pressed={recommendedOnly} onClick={() => setRecommendedOnly(true)} className={button + (recommendedOnly ? ' bg-pine-50 ring-1 ring-pine-700' : '')}>{t('recommended')}</button>
        <button type="button" disabled={!bounds || mapError} onClick={() => void start({kind: 'viewport', bounds})} className={button}>{t('searchArea')}</button>
        <label className="sr-only" htmlFor="discovery-radius">{t('radius')}</label>
        <select id="discovery-radius" value={radius} onChange={event => setRadius(Number(event.target.value) as typeof radius)} className={control}>
          <option value={1000}>1 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option>
        </select>
        <button type="button" className={button + ' inline-flex items-center gap-1'} disabled={!position} onClick={() => void start({kind: 'around', center: position, radius})}><LocateFixed size={15} />{t('nearby')}</button>
      </div>
      {!position && !mapError && <p className="text-xs text-muted">{t('locationHint')}</p>}
      {!canPersistPoi && <p className="text-xs text-muted">{t('persistenceDisabled')}</p>}
      {inputError && <p role="alert" className="text-sm text-rose-700">{t(inputError)}</p>}
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t(discoveryErrorKey(error))}</p>}
      {(result.metadataError || catalogError) && <p role="alert" className="text-sm text-amber-900">{t('catalogFailed')}</p>}
      {searchFailed && <button type="button" className={button} disabled={loading} onClick={async () => {
        const scope = await retry();
        if (scope?.kind === 'around') setFocusCoordinates(scope.center);
      }}>{t('retry')}</button>}

      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative h-[36dvh] min-h-56 md:sticky md:top-4 md:h-[65dvh]">
          {mapError && <div role="alert" className="absolute inset-0 z-30 grid place-content-center gap-2 rounded-xl border border-line bg-pine-50 p-4 text-center text-sm">
            <p>{t('mapError')}</p><button type="button" className={button} onClick={() => {setMapError(false); setMapVersion(old => old + 1);}}>{t('retry')}</button>
          </div>}
          <MapPlaceholder key={mapVersion} discovery shops={shops} selectedShopId={selected} locateSignal={locateSignal}
            onSelectShop={selectFromMap} onViewportBoundsChange={handleBounds} onMapError={showMapError}
            onUserLocationChange={setPosition} onLocationFailure={clearPosition} focusCoordinates={focusCoordinates} />
        </div>

        <section aria-label={t('list')} aria-busy={loading} className="min-w-0 space-y-2 md:max-h-[65dvh] md:overflow-y-auto md:px-1">
          {(loading || !hasRequested.current) && <p role="status" className="p-3 text-sm text-muted">{t('loading')}</p>}
          {hasRequested.current && !loading && !error && !catalogError && !(result.metadataError && recommendedOnly) && entries.length === 0
            && <p className="rounded-xl border border-line p-4 text-sm text-muted">{t(recommendedOnly ? 'noRecommendationsHere' : 'noResults')}</p>}
          {entries.map(entry => <DiscoveryRow key={entry.shop.id} entry={entry} position={position}
            active={selected === entry.shop.id} setNode={node => {
              if (node) entryNodes.current.set(entry.shop.id, node);
              else entryNodes.current.delete(entry.shop.id);
            }}
            onSelect={() => {setSelectedId(entry.shop.id); setLocateSignal(old => old + 1);}}
            legacyFavorites={legacyFavorites} favoriteState={favoriteState} canPersistPoi={canPersistPoi} />)}
          {!searchFailed && (result.amapMore || result.catalogMore) && <button type="button" disabled={loading} onClick={nextPage} className={button + ' w-full'}>{t('more')}</button>}
        </section>
      </div>
      <p className="text-xs text-muted">{t('provider')}</p>
    </main>
  );
}

function DiscoveryRow({entry, active, position, onSelect, setNode, legacyFavorites, favoriteState, canPersistPoi}: {
  entry: DiscoveryEntry; active: boolean; position: Coordinates | null; onSelect: () => void;
  setNode: (node: HTMLElement | null) => void; legacyFavorites: ReturnType<typeof useFavorites>; favoriteState: ReturnType<typeof useDiscoveryFavoriteFlags>; canPersistPoi: boolean
}) {
  const t = useTranslations('Discovery');
  const {shop, poiId, placeId, category} = entry;
  const detail = placeId ? '/shop/' + placeId : '/discover/poi/' + poiId;
  const nav = buildAmapNavigationUrl(shop);
  const distance = position ? distanceMeters(position, shop.coordinates) : null;
  return (
    <article ref={setNode} className={'rounded-xl border bg-white p-3 ' + (active ? 'border-pine-700 ring-1 ring-pine-700' : 'border-line')}>
      <button type="button" onClick={onSelect} aria-pressed={active} className="block min-h-11 w-full text-left focus-visible:ring-2 focus-visible:ring-pine-700">
        <span className="flex flex-wrap items-center gap-2 font-semibold leading-tight">
          <MapPin size={15} className="shrink-0 text-pine-700" aria-hidden="true" />{shop.name}
          {shop.studentRecommended && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900"><Star size={12} aria-hidden="true" />{t('recommended')}</span>}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {[shop.address, category || t('food'), distance == null ? null : distance < 1000 ? Math.round(distance) + ' m' : (distance / 1000).toFixed(1) + ' km'].filter(Boolean).join(' · ')}
        </span>
      </button>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={detail} className={button + ' inline-flex items-center'}>{t('details')}</Link>
        {nav && <a href={nav} target="_blank" rel="noopener noreferrer" className={button + ' inline-flex items-center'}>{t('navigate')}</a>}
        {poiId && (canPersistPoi || !placeId)
          ? <DiscoveryFavorite poiId={poiId} returnPath={detail} state={favoriteState} canSave={canPersistPoi} />
          : <button type="button" className={button} disabled={!legacyFavorites.isLoaded} aria-pressed={legacyFavorites.favorites.includes(shop.id)}
              onClick={() => void legacyFavorites.toggleFavorite(shop.id)}>{t(legacyFavorites.favorites.includes(shop.id) ? 'saved' : 'save')}</button>}
      </div>
    </article>
  );
}
