import {ArrowUpRight, ChevronDown, Heart, List, Map, MapPin, Search, Sparkles} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import ShopCard from '@/components/ShopCard';
import MobilePlaceCard from '@/components/MobilePlaceCard';
import PlaceCover from '@/components/PlaceCover';
import FilterBar from '@/components/FilterBar';
import SecondaryFilters from '@/components/SecondaryFilters';
import QuickFilters from '@/components/QuickFilters';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import AmapDiningCard from '@/components/AmapDiningCard';
import type {AmapPoiOption} from '@/lib/amap/place-search';
import type {useNearbyBusinesses} from '@/lib/hooks/useNearbyBusinesses';
import type {useStudentRecommendations} from '@/lib/hooks/useStudentRecommendations';
import {DrawerFiltersState, Shop, ShopCategoryKey} from '@/types/shop';
import {getSheetHeights, resolveSheetDrag, type MobileSheetSnap} from '@/lib/ui/mobile-sheet';

interface ShopListProps {
  layout: 'desktop' | 'mobile';
  filteredShops: Shop[];
  publishedShops?: Shop[];
  liveRestaurants?: ReturnType<typeof useNearbyBusinesses>;
  showCatalogSource?: boolean;
  showStudentPicks: boolean;
  setShowStudentPicks: (show: boolean) => void;
  studentRecommendations: ReturnType<typeof useStudentRecommendations>;
  onLocateRestaurant?: (place: AmapPoiOption) => void;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onLocateShop: (shopId: Shop['id']) => boolean;
  mobileSearchPlaceholder: string;
  emptyText: string;
  hasAnyShops: boolean;
  hasActiveFilters: boolean;
  activeFilterLabels: string[];
  onClearSearch: () => void;
  onClearAllFilters: () => void;
  canApprove?: boolean;
  approvingShopId?: Shop['id'] | null;
  onApproveShop?: (shopId: Shop['id']) => void;
  canDelete?: boolean;
  deletingShopId?: Shop['id'] | null;
  onDeleteShop?: (shopId: Shop['id']) => void;
  collapseMobileSheetSignal?: number;
  mobileTopOffsetPx?: number;
  onToggleAssistant?: () => void;
  drawerFilters: DrawerFiltersState;
  onChangeDrawerFilters: (next: DrawerFiltersState) => void;
  activeL1?: ShopCategoryKey;
  activeL2?: string[];
  onL1Change?: (l1: ShopCategoryKey) => void;
  onL2Change?: (l1: ShopCategoryKey, l2: string | null) => void;
  showFavorites?: boolean;
  setShowFavorites?: (next: boolean) => void;
  favorites?: string[];
  onToggleFavorite?: (shopId: string, e: React.MouseEvent) => void;
}

export default function ShopList({
  layout,
  filteredShops,
  publishedShops,
  liveRestaurants,
  showCatalogSource,
  showStudentPicks,
  setShowStudentPicks,
  studentRecommendations,
  onLocateRestaurant,
  loading,
  searchQuery,
  setSearchQuery,
  onLocateShop,
  mobileSearchPlaceholder,
  emptyText,
  hasAnyShops,
  hasActiveFilters,
  activeFilterLabels,
  onClearSearch,
  onClearAllFilters,
  canApprove,
  approvingShopId,
  onApproveShop,
  canDelete,
  deletingShopId,
  onDeleteShop,
  collapseMobileSheetSignal = 0,
  mobileTopOffsetPx = 116,
  onToggleAssistant,
  drawerFilters,
  onChangeDrawerFilters,
  activeL1 = 'all',
  activeL2 = [],
  onL1Change,
  onL2Change,
  showFavorites,
  setShowFavorites,
  favorites,
  onToggleFavorite
}: ShopListProps) {
  const tFilters = useTranslations('Filters');
  const tHome = useTranslations('Home');
  const tLive = useTranslations('LiveDiscovery');
  const sheetId = 'discovery-shop-sheet';
  const listId = `discovery-${layout}-shop-list`;
  const [navBottom, setNavBottom] = useState(0);

  const [mobileSnap, setMobileSnap] = useState<MobileSheetSnap>('collapsed');
  const previousCategoryRef = useRef(activeL1);
  const [mobileHeight, setMobileHeight] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(844);
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [recentlyLocatedShopId, setRecentlyLocatedShopId] = useState<Shop['id'] | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const skipDragClickRef = useRef(false);
  const dragStartHeightRef = useRef<number>(0);
  const locateHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (collapseMobileSheetSignal > 0) setMobileSnap('hidden');
    setMobileHeight(null);
  }, [collapseMobileSheetSignal]);

  useEffect(() => {
    return () => {
      if (locateHighlightTimerRef.current) {
        clearTimeout(locateHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousCategoryRef.current !== activeL1) {
      setMobileSnap('full');
      setMobileHeight(null);
    }
    previousCategoryRef.current = activeL1;
  }, [activeL1]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setMobileSnap('full');
      setMobileHeight(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    const resize = () => {
      setViewportHeight(window.innerHeight);
      setNavBottom(document.getElementById('main-navigation')?.getBoundingClientRect().height ?? 0);
      dragStartYRef.current = null;
      setIsDragging(false);
      setMobileHeight(null);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (mobileSnap === 'hidden' && sheetRef.current?.contains(document.activeElement)) {
      restoreRef.current?.focus({preventScroll: true});
    }
  }, [mobileSnap]);

  const heights = getSheetHeights(viewportHeight - navBottom, mobileTopOffsetPx);
  const getSnapHeight = (snap: MobileSheetSnap) => heights[snap];

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartHeightRef.current = getSnapHeight(mobileSnap);
    setIsDragging(true);
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;

    const delta = dragStartYRef.current - clientY;
    const next = Math.max(0, Math.min(heights.full, dragStartHeightRef.current + delta));
    setMobileHeight(next);
  };

  const endDrag = (clientY?: number) => {
    if (dragStartYRef.current === null) return;
    setIsDragging(false);

    const delta = clientY !== undefined ? dragStartYRef.current - clientY : 0;
    const nextSnap = resolveSheetDrag(mobileSnap, dragStartHeightRef.current, delta, heights.full);

    skipDragClickRef.current = Math.abs(delta) > 8;
    setTimeout(() => {skipDragClickRef.current = false;}, 0);
    setMobileSnap(nextSnap);
    setMobileHeight(null);
    dragStartYRef.current = null;
  };

  const emptyState = useMemo(() => {
    if (!hasAnyShops) {
      return {
        title: tHome('empty.noShopsTitle'),
        description: tHome('empty.noShopsDescription'),
        actionLabel: null as string | null,
        action: null as (() => void) | null
      };
    }

    if (hasActiveFilters || searchQuery.trim().length > 0) {
      return {
        title: tHome('empty.noMatchTitle'),
        description: tHome('empty.noMatchDescription'),
        actionLabel: tHome('empty.clearAllAction'),
        action: onClearAllFilters
      };
    }

    return {
      title: tHome('empty.noDisplayTitle'),
      description: emptyText,
      actionLabel: null as string | null,
      action: null as (() => void) | null
    };
  }, [emptyText, hasActiveFilters, hasAnyShops, onClearAllFilters, searchQuery, tHome]);

  const handleLocateWithHighlight = (shopId: Shop['id']) => {
    const located = onLocateShop(shopId);
    if (!located) {
      return;
    }

    setRecentlyLocatedShopId(shopId);

    if (locateHighlightTimerRef.current) {
      clearTimeout(locateHighlightTimerRef.current);
    }

    locateHighlightTimerRef.current = setTimeout(() => {
      setRecentlyLocatedShopId(null);
    }, 1000);
  };

  const currentSheetHeight = mobileHeight ?? getSnapHeight(mobileSnap);
  const currentSheetHeightStyle = `${currentSheetHeight}px`;
  const provider = liveRestaurants?.available && !liveRestaurants.failed ? liveRestaurants : null;
  const listCount = provider?.items.length ?? filteredShops.length;
  const listLoading = provider?.loading ?? loading;
  const sourceMessage = liveRestaurants
    ? liveRestaurants.failed ? tLive('catalogFallback')
      : !liveRestaurants.available ? tLive('catalogZoom')
      : liveRestaurants.loading ? tLive('loading')
      : liveRestaurants.partial ? tLive('diningLimit') : tLive('diningOrder')
    : showCatalogSource ? tLive('catalogSource') : null;
  const liveStatus = sourceMessage && <p data-dining-source role="status" className="pb-1 text-xs leading-relaxed text-muted">
    {sourceMessage}
  </p>;
  const liveCards = provider && onLocateRestaurant && (provider.items.length
    ? provider.items.map(place => <AmapDiningCard key={place.placeId} place={place} onLocate={onLocateRestaurant} />)
    : <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">{tLive('diningEmpty')}</p>);

  const {result: studentResult, retry: retryStudentPicks} = studentRecommendations;
  const studentCoverByPlaceId = useMemo(() => {
    const covers: Record<string, string | undefined> = {};
    for (const shop of publishedShops ?? filteredShops) {
      covers[shop.id] = shop.imageUrls?.find(url => typeof url === 'string' && url.trim().length > 0);
    }
    return covers;
  }, [publishedShops, filteredShops]);
  const visibleCount = showStudentPicks ? (studentResult.status === 'ready' ? studentResult.items.length : 0) : listCount;
  const viewKey = showStudentPicks ? 'student' : 'nearby';

  const sourceButtons = (controls: string, mobile: boolean) => (
    <div role="group" aria-label={tLive('listSourceLabel')} className="grid min-w-0 grid-cols-2 gap-1 rounded-xl bg-pine-50 p-1">
      {[false, true].map(isStudent => (
        <button type="button" key={String(isStudent)} data-discovery-action={isStudent ? 'student' : 'show-nearby'}
          aria-controls={controls} aria-pressed={showStudentPicks === isStudent}
          onClick={() => {
            setShowStudentPicks(isStudent);
            if (mobile && isStudent) {
              setMobileSnap('full');
              setMobileHeight(null);
            }
          }}
          className="min-h-10 rounded-lg px-2 text-sm font-semibold text-muted hover:text-pine-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine-700 aria-[pressed=true]:bg-white aria-[pressed=true]:text-pine-800 aria-[pressed=true]:shadow-sm">
          {isStudent ? tLive('student') : tHome('mobile.placesTitle')}
        </button>
      ))}
    </div>
  );
  const studentList = (
    <div data-student-recommendations>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-pine-100/80 bg-pine-50/60 px-3 py-2 text-xs leading-5 text-pine-800">
        <Sparkles size={14} aria-hidden className="shrink-0 text-pine-700" />
        <span>{tLive('studentSource')}</span>
      </div>
      {studentResult.status === 'loading' && (
        <div role="status" aria-label={tLive('loading')} className="space-y-2.5">
          {Array.from({length: 4}).map((_, index) => (
            <div key={index} className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white p-3">
              <div className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-2xl bg-[#eeefeb]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded-md bg-[#eeefeb]" />
                <div className="h-3 w-5/6 animate-pulse rounded-md bg-[#f3f4f0]" />
              </div>
            </div>
          ))}
        </div>
      )}
      {studentResult.status === 'error' && (
        <div className="rounded-[20px] border border-dashed border-line bg-white px-4 py-6 text-center">
          <p role="status" className="text-sm text-muted">{tLive('studentUnavailable')}</p>
          <button type="button" onClick={retryStudentPicks}
            className="mt-3 min-h-11 rounded-xl border border-pine-200 bg-pine-50/50 px-4 text-sm font-semibold text-pine-800 transition hover:bg-pine-50 focus-visible:ring-2 focus-visible:ring-pine-700">
            {tLive('retry')}
          </button>
        </div>
      )}
      {studentResult.status === 'ready' && studentResult.items.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-line bg-white px-4 py-8 text-center">
          <p role="status" className="text-sm text-muted">{tLive('studentEmpty')}</p>
        </div>
      )}
      {studentResult.status === 'ready' && studentResult.items.length > 0 && <ul className="space-y-2.5">
        {studentResult.items.map(place => {
          const branch = /^(.*?)\s*[（(]([^（）()]+)[）)]$/.exec(place.name);
          return (
            <li key={place.place_id}>
              <Link href={`/shop/${place.place_id}`}
                className="group flex min-h-[92px] items-center gap-3.5 rounded-[20px] border border-line bg-white p-3 text-ink shadow-[0_1px_2px_rgba(25,61,50,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pine-200 hover:bg-pine-50/35 hover:shadow-[0_6px_18px_rgba(25,61,50,0.08)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700">
                <span className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/5">
                  <span className="block h-full w-full transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none">
                    <PlaceCover src={studentCoverByPlaceId[place.place_id]} name={place.name} size={68} />
                  </span>
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="line-clamp-2 block text-[15px] font-semibold leading-[1.4] text-ink transition-colors group-hover:text-pine-800">
                    {branch?.[1] ? branch[1] : place.name}
                  </span>
                  {branch?.[1] && (
                    <span className="mt-0.5 line-clamp-1 block text-xs leading-4 text-muted">
                      ({branch[2]})
                    </span>
                  )}
                  {place.address && (
                    <span className="mt-1.5 flex items-start gap-1 text-xs leading-4 text-muted">
                      <MapPin size={12} aria-hidden className="mt-0.5 shrink-0 text-pine-700/65" />
                      <span className="line-clamp-2">{place.address}</span>
                    </span>
                  )}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-50/90 text-pine-700 transition-colors group-hover:bg-pine-700 group-hover:text-white">
                  <ArrowUpRight size={15} aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>}
    </div>
  );

  const quickFilters = (
    <QuickFilters count={listCount} loading={listLoading} filters={drawerFilters}
      onChange={onChangeDrawerFilters} showFavorites={showFavorites} onFavoritesChange={setShowFavorites}
      hasActiveFilters={hasActiveFilters} extraLabels={activeFilterLabels} onClear={onClearAllFilters} />
  );

  const desktopListContent = (
    <>
      {sourceButtons(listId, false)}
      {!showStudentPicks && <>
        <div className="mb-3 hidden md:block">
          <FilterBar activeL1={activeL1} activeL2={activeL2}
            onCategoryChange={l1 => onL1Change?.(l1)}
            onSecondaryChange={value => onL2Change?.(activeL1, value)} />
        </div>
        <div className="mb-2 relative md:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={mobileSearchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-20 text-sm outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] focus:border-[#006633]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
            >
              {tHome('common.clear')}
            </button>
          )}
        </div>

        {quickFilters}
      </>}
      <div key={viewKey} id={listId} className="mt-2 min-h-0 flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
        {!showStudentPicks && liveStatus}
        {showStudentPicks ? studentList : listLoading ? (
          Array.from({length: 6}).map((_, index) => <ShopCardSkeleton key={`skeleton-${index}`} />)
        ) : provider ? liveCards : (
          <div className="space-y-3">
            {filteredShops.map((shop) => (
              <div key={shop.id}>
                <ShopCard
                  shop={shop}
                  onLocate={handleLocateWithHighlight}
                  isLocateHighlighted={recentlyLocatedShopId === shop.id}
                  canApprove={canApprove}
                  approving={approvingShopId === shop.id}
                  onApprove={onApproveShop}
                  canDelete={canDelete}
                  deleting={deletingShopId === shop.id}
                  onDelete={onDeleteShop}
                  isFavorite={favorites?.includes(shop.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            ))}
            {filteredShops.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">{emptyState.title}</p>
                <p className="mt-1 text-xs text-slate-500">{emptyState.description}</p>
                {emptyState.actionLabel && emptyState.action && (
                  <button
                    type="button"
                    onClick={emptyState.action}
                    className="mt-3 rounded-lg border border-[#006633]/20 bg-[#006633] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {emptyState.actionLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (layout === 'desktop') {
    return <div className="hidden h-full min-h-0 w-full flex-col gap-2 md:flex">{desktopListContent}</div>;
  }
  return (
    <>
      {mobileSnap !== 'full' && (
        <div className="pointer-events-none fixed inset-x-4 z-40 flex items-center gap-2 md:hidden"
          style={{bottom: mobileSnap === 'hidden' ? 'calc(var(--main-nav-bottom, 0px) + 16px)' : `calc(${currentSheetHeight}px + 16px + var(--main-nav-bottom, 0px))`}}>
          {mobileSnap === 'hidden' && <button ref={restoreRef} type="button" onClick={() => setMobileSnap('collapsed')}
            aria-controls={sheetId} aria-expanded={false}
            className="pointer-events-auto inline-flex min-h-12 min-w-0 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink shadow-lg shadow-pine-900/10 focus-visible:ring-2 focus-visible:ring-pine-700">
            <List size={18} aria-hidden="true" /><span className="truncate">{tHome('mobile.showList', {count: visibleCount})}</span>
          </button>}
          {onToggleAssistant && <button type="button" onClick={onToggleAssistant} aria-haspopup="dialog" aria-controls="home-ai-dialog"
            className="pointer-events-auto inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-pine-800 px-4 text-sm font-medium text-white shadow-lg shadow-pine-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2">
            <Sparkles size={19} aria-hidden="true" className="text-pine-100" />{tHome('mobile.assistant')}
          </button>}
        </div>
      )}
      <div ref={sheetRef} id={sheetId} data-shop-sheet aria-hidden={mobileSnap === 'hidden'} inert={mobileSnap === 'hidden'}
        className={`fixed inset-x-0 bottom-[var(--main-nav-bottom)] z-40 flex flex-col rounded-t-[28px] border-t border-line bg-canvas px-4 shadow-[0_-4px_24px_#193d320c] md:hidden ${!isDragging ? 'transition-[height,transform] duration-300 motion-reduce:transition-none' : ''}`}
        style={{height: mobileSnap === 'hidden' ? `${heights.collapsed}px` : mobileSnap === 'full' && !isDragging ? `calc(100dvh - ${mobileTopOffsetPx + 4}px - var(--main-nav-bottom, 0px))` : currentSheetHeightStyle, maxHeight: `calc(100dvh - ${mobileTopOffsetPx + 4}px - var(--main-nav-bottom, 0px))`, transform: mobileSnap === 'hidden' ? 'translateY(calc(100% + 32px))' : undefined}}
      >
        <div className="relative h-11 shrink-0">
          <button type="button" aria-label={tHome('mobile.expandCollapseDrawerAria')} aria-expanded={mobileSnap === 'full'}
            onClick={() => {
              if (skipDragClickRef.current) {skipDragClickRef.current = false; return;}
              setMobileSnap(previous => previous === 'collapsed' ? 'full' : 'collapsed');
            }}
            onPointerDown={event => {if (event.isPrimary) {event.currentTarget.setPointerCapture(event.pointerId); startDrag(event.clientY);}}}
            onPointerMove={event => {if (event.isPrimary) moveDrag(event.clientY);}}
            onPointerUp={event => {if (event.isPrimary) endDrag(event.clientY);}} onPointerCancel={() => {dragStartYRef.current = null; setIsDragging(false); setMobileHeight(null);}}
            className="flex h-11 w-full shrink-0 touch-none cursor-grab items-center justify-center rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine-700 active:cursor-grabbing">
            <span className="h-1 w-9 rounded-full bg-[#cbd3cb]" />
          </button>
          <button type="button" onClick={() => setMobileSnap('hidden')} aria-label={tHome('mobile.hideList')} title={tHome('mobile.hideList')}
            className="absolute -right-1 top-0 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-pine-50 focus-visible:ring-2 focus-visible:ring-pine-700"><ChevronDown size={20} aria-hidden="true" /></button>
        </div>
        <div className="mb-2 shrink-0">{sourceButtons(listId, true)}</div>
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          {(!showStudentPicks || studentResult.status === 'ready') &&
            <span role="status" className="text-xs text-muted">{tFilters('currentTotal', {count: visibleCount})}</span>}
          {!showStudentPicks && showFavorites !== undefined && setShowFavorites && <button type="button" aria-pressed={showFavorites} onClick={() => setShowFavorites(!showFavorites)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-pine-700 ${showFavorites ? 'border-pine-200 bg-pine-50 text-pine-700' : 'border-line bg-white text-muted'}`}>
            <Heart size={16} aria-hidden="true" className={showFavorites ? 'fill-current' : ''} />{tFilters('onlyFavorites')}
          </button>}
        </div>
        {!showStudentPicks && mobileSnap === 'full' && <div className="mb-2 max-h-[35dvh] shrink-0 overflow-y-auto">
          {activeL1 !== 'all' && onL2Change && <div className="mb-2"><SecondaryFilters key={activeL1} category={activeL1} selected={activeL2} onSelect={value => onL2Change(activeL1, value)} /></div>}
          <QuickFilters compact count={listCount} loading={listLoading} filters={drawerFilters} onChange={onChangeDrawerFilters}
            hasActiveFilters={hasActiveFilters} extraLabels={activeFilterLabels} onClear={onClearAllFilters} />
        </div>}
        <div key={viewKey} id={listId} className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {!showStudentPicks && liveStatus}
          {showStudentPicks ? studentList : listLoading ? <div className="space-y-3">{Array.from({length: 4}).map((_, index) => <ShopCardSkeleton key={index} />)}</div>
            : provider ? <div className="space-y-3">{liveCards}</div>
            : filteredShops.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink">{emptyState.title}</p><p className="mt-2 text-sm leading-6 text-muted">{emptyState.description}</p>
              {emptyState.action && <button type="button" onClick={emptyState.action} className="mt-4 min-h-11 rounded-xl bg-pine-700 px-4 text-sm text-white">{emptyState.actionLabel}</button>}
            </div>
            : <div className="space-y-3">{filteredShops.map(shop => <MobilePlaceCard key={shop.id} shop={shop} favorite={favorites?.includes(shop.id) ?? false} onFavorite={onToggleFavorite} onLocate={handleLocateWithHighlight} highlighted={recentlyLocatedShopId === shop.id} />)}</div>}
        </div>
        {mobileSnap === 'full' && <div className="flex shrink-0 flex-wrap justify-center gap-2 border-t border-line bg-canvas py-2">
          <button type="button" onClick={() => setMobileSnap('hidden')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-pine-800 px-5 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"><Map size={17} aria-hidden="true" />{tHome('mobile.showMap')}</button>
          {onToggleAssistant && <button type="button" onClick={onToggleAssistant} aria-haspopup="dialog" aria-controls="home-ai-dialog"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-pine-800 focus-visible:ring-2 focus-visible:ring-pine-700"><Sparkles size={17} aria-hidden />{tHome('mobile.assistant')}</button>}
        </div>}
        {mobileSnap === 'collapsed' && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
      </div>
    </>
  );
}
