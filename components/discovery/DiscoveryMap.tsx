
'use client';

import {useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft, LocateFixed, Search} from 'lucide-react';
import {getPathname, Link} from '@/i18n/navigation';
import MobilePlaceCard from '@/components/MobilePlaceCard';
import type {MobileSheetSnap} from '@/lib/ui/mobile-sheet';
import DiscoveryResultsSheet from './DiscoveryResultsSheet';
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
  const searchFormId = useId();
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [snap, setSnap] = useState<MobileSheetSnap>('collapsed');
  const [controlsBottom, setControlsBottom] = useState(216);
  const controlsRef = useRef<HTMLDivElement>(null);
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
  const retryMap = () => {
    setMapError(false);
    setMapVersion(old => old + 1);
  };
  const clearPosition = useCallback(() => setPosition(null), []);
  const start = useCallback(async (value: unknown) => {
    hasRequested.current = true;
    const parsed = discoveryQuery.safeParse(value);
    if (!parsed.success || parsed.data.kind === 'detail' || parsed.data.kind === 'details') {
      setInputError(value && typeof value === 'object' && 'kind' in value && value.kind === 'viewport' ? 'viewportInvalid' : 'searchInvalid');
      return;
    }
    setInputError(null);
    setSearchOpen(false);
    setSnap(previous => previous === 'hidden' ? 'collapsed' : previous);
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

  useEffect(() => {
    const element = controlsRef.current;
    if (!element) return;
    const measure = () => setControlsBottom(Math.ceil(element.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    setSnap(previous => previous === 'hidden' ? 'collapsed' : previous);
    requestAnimationFrame(() => entryNodes.current.get(id)?.scrollIntoView({block: 'nearest', behavior: 'smooth'}));
  }, []);

  return (
    <main className="min-h-dvh text-ink md:flex md:h-dvh md:flex-col md:bg-slate-50">
      <div ref={controlsRef} className="fixed inset-x-0 top-0 z-50 mx-auto max-h-[48dvh] space-y-2 overflow-y-auto bg-canvas/95 px-3 pb-2 pt-[max(env(safe-area-inset-top),8px)] shadow-sm backdrop-blur-sm md:static md:max-h-none md:w-full md:shrink-0 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className={button + ' inline-flex items-center gap-2'}><ArrowLeft size={16} />{t('back')}</Link>
          <h1 className="text-xl font-semibold md:text-2xl">{t('title')}</h1>
          <Link href="/discover/favorites" className={button + ' inline-flex items-center'}>{t('favorites')}</Link>
        </header>

        <form id={searchFormId} onSubmit={searchText}
          className={'grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-2 md:flex md:flex-wrap ' + (searchOpen ? 'grid' : 'hidden')}>
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
          <button type="button" aria-controls={searchFormId} aria-expanded={searchOpen} onClick={() => setSearchOpen(open => !open)}
            className={button + ' inline-flex items-center gap-1 md:hidden'}><Search size={16} aria-hidden="true" />{t('search')}</button>
          <div className={position || searchOpen ? 'contents' : 'hidden md:contents'}>
          <label className="sr-only" htmlFor="discovery-radius">{t('radius')}</label>
          <select id="discovery-radius" value={radius} onChange={event => setRadius(Number(event.target.value) as typeof radius)} className={control}>
            <option value={1000}>1 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option>
          </select>
          <button type="button" className={button + ' inline-flex items-center gap-1'} disabled={!position} onClick={() => void start({kind: 'around', center: position, radius})}><LocateFixed size={15} />{t('nearby')}</button>
          </div>
        </div>
        {!position && !mapError && <p className={'text-xs text-muted ' + (searchOpen ? '' : 'hidden md:block')}>{t('locationHint')}</p>}
      </div>
      <div className="relative mx-auto max-w-[1380px] md:grid md:min-h-0 md:w-full md:flex-1 md:grid-cols-12 md:gap-4 md:px-8 md:py-3">
        <div className="fixed inset-0 z-0 md:relative md:inset-auto md:col-span-8 md:col-start-5 md:row-start-1 md:min-h-0"
          style={{'--discovery-controls-top': (controlsBottom + 10) + 'px'} as CSSProperties}>
          {mapError && <div role="alert" className="absolute inset-0 z-30 hidden rounded-2xl border border-line bg-canvas p-4 text-center text-sm md:grid md:place-content-center md:gap-2">
            <p>{t('mapError')}</p><button type="button" className={button} onClick={retryMap}>{t('retry')}</button>
          </div>}
          <MapPlaceholder key={mapVersion} discovery shops={shops} selectedShopId={selected} locateSignal={locateSignal}
            onSelectShop={selectFromMap} onViewportBoundsChange={handleBounds} onMapError={showMapError}
            onUserLocationChange={setPosition} onLocationFailure={clearPosition} focusCoordinates={focusCoordinates} />
        </div>

        <DiscoveryResultsSheet snap={snap} onSnap={setSnap} top={controlsBottom} loading={loading} count={entries.length}>
          {mapError && <div role="alert" className="rounded-2xl border border-line bg-white p-3 text-sm md:hidden">
            <p className="mb-2">{t('mapError')}</p>
            <button type="button" className={button} onClick={retryMap}>{t('retry')}</button>
          </div>}
          {!canPersistPoi && <p className="text-xs text-muted">{t('persistenceDisabled')}</p>}
          {inputError && <p role="alert" className="text-sm text-rose-700">{t(inputError)}</p>}
          {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t(discoveryErrorKey(error))}</p>}
          {(result.metadataError || catalogError) && <p role="alert" className="text-sm text-amber-900">{t('catalogFailed')}</p>}
          {searchFailed && <button type="button" className={button} disabled={loading} onClick={async () => {
            const scope = await retry();
            if (scope?.kind === 'around') setFocusCoordinates(scope.center);
          }}>{t('retry')}</button>}

          {(loading || !hasRequested.current) && <p role="status" className="p-3 text-sm text-muted">{t('loading')}</p>}
          {hasRequested.current && !loading && !error && !catalogError && !(result.metadataError && recommendedOnly) && entries.length === 0
            && <p className="rounded-xl border border-line p-4 text-sm text-muted">{t(recommendedOnly ? 'noRecommendationsHere' : 'noResults')}</p>}
          {entries.map(entry => <DiscoveryRow key={entry.shop.id} entry={entry} position={position}
            active={selected === entry.shop.id} setNode={node => {
              if (node) entryNodes.current.set(entry.shop.id, node);
              else entryNodes.current.delete(entry.shop.id);
            }}
            onSelect={() => {setSelectedId(entry.shop.id); setSnap('collapsed'); setLocateSignal(old => old + 1);}}
            legacyFavorites={legacyFavorites} favoriteState={favoriteState} canPersistPoi={canPersistPoi} />)}
          {!searchFailed && (result.amapMore || result.catalogMore) && <button type="button" disabled={loading} onClick={nextPage} className={button + ' w-full'}>{t('more')}</button>}
          <p className="text-xs text-muted">{t('provider')}</p>
        </DiscoveryResultsSheet>
      </div>
    </main>
  );
}

function DiscoveryRow({entry, active, position, onSelect, setNode, legacyFavorites, favoriteState, canPersistPoi}: {
  entry: DiscoveryEntry; active: boolean; position: Coordinates | null; onSelect: () => void;
  setNode: (node: HTMLElement | null) => void; legacyFavorites: ReturnType<typeof useFavorites>; favoriteState: ReturnType<typeof useDiscoveryFavoriteFlags>; canPersistPoi: boolean
}) {
  const t = useTranslations('Discovery');
  const locale = useLocale();
  const {shop, poiId, placeId, category} = entry;
  const detail = placeId ? '/shop/' + placeId : '/discover/poi/' + poiId;
  const nav = buildAmapNavigationUrl(shop);
  const distance = position ? distanceMeters(position, shop.coordinates) : null;
  const subtitle = [shop.address, category || t('food'), distance == null ? null
    : distance < 1000 ? Math.round(distance) + ' m' : (distance / 1000).toFixed(1) + ' km'].filter(Boolean).join(' · ');
  return (
    <div ref={setNode}>
      <MobilePlaceCard shop={shop} favorite={legacyFavorites.favorites.includes(shop.id)}
        onFavorite={placeId && (!poiId || !canPersistPoi) && legacyFavorites.isLoaded ? legacyFavorites.toggleFavorite : undefined}
        onLocate={onSelect} highlighted={active}
        detailHref={getPathname({href: detail, locale})}
        discovery={{subtitle, recommendedLabel: t('recommended'), actions: <>
          {nav && <a href={nav} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-full border border-line px-2 text-xs text-pine-800">{t('navigate')}</a>}
          {poiId && (canPersistPoi || !placeId) && <DiscoveryFavorite poiId={poiId} returnPath={detail} state={favoriteState} canSave={canPersistPoi} />}
        </>}}
      />
    </div>
  );
}
