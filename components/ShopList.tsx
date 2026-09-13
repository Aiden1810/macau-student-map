import Image from 'next/image';
import Link from 'next/link';
import {ChevronDown, Navigation, Search, Star, StarHalf} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {DISCOVERY_TABS} from '@/lib/search/filter-options';
import ShopCard from '@/components/ShopCard';
import FilterBar from '@/components/FilterBar';
import SecondaryFilters from '@/components/SecondaryFilters';
import QuickFilters from '@/components/QuickFilters';
import PlaceTypeBadge from '@/components/PlaceTypeBadge';
import {formatPlacePrice} from '@/lib/domain/place-types';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import {DrawerFiltersState, Shop, ShopCategoryKey} from '@/types/shop';

interface ShopListProps {
  filteredShops: Shop[];
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
  canApprove: boolean;
  approvingShopId: Shop['id'] | null;
  onApproveShop: (shopId: Shop['id']) => void;
  canDelete: boolean;
  deletingShopId: Shop['id'] | null;
  onDeleteShop: (shopId: Shop['id']) => void;
  collapseMobileSheetSignal?: number;
  mobileTopOffsetPx?: number;
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

const SHEET_COLLAPSED_HEIGHT = 280;

type MobileSheetSnap = 'collapsed' | 'full';

const MOBILE_GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(235, 245, 236, 0.75)',
  backdropFilter: 'blur(32px) saturate(2) brightness(1.05)',
  WebkitBackdropFilter: 'blur(32px) saturate(2) brightness(1.05)',
  borderTop: '0.5px solid rgba(255, 255, 255, 0.85)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)'
};

export default function ShopList({
  filteredShops,
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
  const tShopDetail = useTranslations('ShopDetail');
  const locale = useLocale();

  const [mobileSnap, setMobileSnap] = useState<MobileSheetSnap>('collapsed');
  const [mobileHeight, setMobileHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [recentlyLocatedShopId, setRecentlyLocatedShopId] = useState<Shop['id'] | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef<number>(0);
  const locateHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMobileSnap('collapsed');
    setMobileHeight(0);
  }, [collapseMobileSheetSignal]);

  useEffect(() => {
    return () => {
      if (locateHighlightTimerRef.current) {
        clearTimeout(locateHighlightTimerRef.current);
      }
    };
  }, []);

  const getViewportHeight = () => (typeof window === 'undefined' ? 0 : window.innerHeight);
  const getCollapsedHeightPx = () => SHEET_COLLAPSED_HEIGHT;
  const getExpandedHeightPx = () => Math.max(300, getViewportHeight() - mobileTopOffsetPx);

  const getSnapHeight = (snap: MobileSheetSnap) => {
    if (snap === 'collapsed') return getCollapsedHeightPx();
    return getExpandedHeightPx();
  };

  const resolveClosestSnap = (height: number): MobileSheetSnap => {
    const collapsedDistance = Math.abs(getCollapsedHeightPx() - height);
    const expandedDistance = Math.abs(getExpandedHeightPx() - height);
    return expandedDistance < collapsedDistance ? 'full' : 'collapsed';
  };

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartHeightRef.current = getSnapHeight(mobileSnap);
    setIsDragging(true);
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;

    const delta = dragStartYRef.current - clientY;
    const next = Math.max(getCollapsedHeightPx(), Math.min(getExpandedHeightPx(), dragStartHeightRef.current + delta));
    setMobileHeight(next);
  };

  const endDrag = (clientY?: number) => {
    if (dragStartYRef.current === null) return;
    setIsDragging(false);

    const currentHeight = mobileHeight || dragStartHeightRef.current;
    const delta = clientY !== undefined ? dragStartYRef.current - clientY : 0;
    let nextSnap = resolveClosestSnap(currentHeight);

    if (Math.abs(delta) > 36) {
      nextSnap = delta > 0 ? 'full' : 'collapsed';
    }

    setMobileSnap(nextSnap);
    setMobileHeight(0);
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

  const currentSheetHeight = mobileHeight > 0 ? mobileHeight : getSnapHeight(mobileSnap);
  const currentSheetHeightStyle = `${currentSheetHeight}px`;

  const quickFilters = (
    <QuickFilters count={filteredShops.length} loading={loading} filters={drawerFilters}
      onChange={onChangeDrawerFilters} showFavorites={showFavorites} onFavoritesChange={setShowFavorites}
      hasActiveFilters={hasActiveFilters} extraLabels={activeFilterLabels} onClear={onClearAllFilters} />
  );

  const desktopListContent = (
    <>
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
      <div className="mt-2 flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
        {loading ? (
          Array.from({length: 6}).map((_, index) => <ShopCardSkeleton key={`skeleton-${index}`} />)
        ) : (
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

  return (
    <>
      <div className="hidden w-full flex-col gap-2 md:flex">{desktopListContent}</div>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[26px] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.65rem)] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:hidden ${!isDragging ? 'transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]' : ''}`}
        style={{height: currentSheetHeightStyle, ...MOBILE_GLASS_STYLE}}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={tHome('mobile.expandCollapseDrawerAria')}
          onClick={() => setMobileSnap((prev) => (prev === 'collapsed' ? 'full' : 'collapsed'))}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={(e) => endDrag(e.changedTouches[0].clientY)}
          onMouseDown={(e) => startDrag(e.clientY)}
          onMouseMove={(e) => moveDrag(e.clientY)}
          onMouseUp={(e) => endDrag(e.clientY)}
          onMouseLeave={() => endDrag()}
          className="mx-auto -mt-2 mb-2 flex h-8 w-full cursor-grab items-center justify-center touch-none outline-none active:cursor-grabbing"
        >
          <div className="h-1 w-[34px] rounded-[2px] bg-[#1A5C2E]/35" />
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1A5C2E]/75" />
          <input
            type="text"
            placeholder={tHome('mobile.searchPlaceholder')}
            className="h-[37px] w-full rounded-[13px] appearance-none bg-[rgba(255,255,255,0.55)] py-2 pl-10 pr-16 text-sm text-[#0d2918] placeholder:text-[#1A5C2E]/60 shadow-[0_0_0_1px_rgba(255,255,255,0.6)] outline-none focus:outline-none focus:ring-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/55 px-2 py-1 text-[11px] font-medium text-[#1A5C2E]"
            >
              {tHome('common.clear')}
            </button>
          )}
        </div>

        {mobileSnap === 'collapsed' && <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#0d2918]">{tHome('mobile.pullUpHint')}</p>
            {mobileSnap === 'collapsed' && showFavorites !== undefined && setShowFavorites !== undefined && (
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                  showFavorites
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-rose-50/80 text-rose-600 border border-rose-100'
                }`}
              >
                {showFavorites ? tHome('mobile.favoritesOn') : tHome('mobile.favoritesOff')}
              </button>
            )}
          </div>
          <span className="shrink-0 rounded-2xl bg-[rgba(26,92,46,0.10)] px-2.5 py-1 text-xs font-semibold text-[#1A5C2E]">{tFilters('currentTotal', {count: filteredShops.length})}</span>
        </div>}

        <div className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {DISCOVERY_TABS.map(({key: l1Key, label}) => {
            const isActive = activeL1 === l1Key;
            return (
              <button
                key={l1Key}
                type="button"
                aria-pressed={isActive}
                onClick={() => {onL1Change?.(l1Key); setMobileSnap('full');}}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'border-[rgba(26,92,46,0.35)] bg-[rgba(22,80,38,0.12)] text-[#0d2918]'
                    : 'border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.55)] text-[#0d2918]'
                }`}
              >
                <span>
                  {label}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isActive ? 'rotate-180' : ''}`} />
              </button>
            );
          })}
        </div>

        {activeL1 !== 'all' && onL2Change && (
          <div className="mb-2">
            <SecondaryFilters key={activeL1} category={activeL1} selected={activeL2} onSelect={value => onL2Change(activeL1, value)} />
          </div>
        )}
        {mobileSnap === 'full' && quickFilters}

        <div className="mt-1 min-h-0 flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),72px)]">
            {loading ? (
              <div className="space-y-2">
                {Array.from({length: 4}).map((_, index) => (
                  <div key={`mobile-skeleton-${index}`} className="rounded-2xl bg-white/38 p-3">
                    <ShopCardSkeleton />
                  </div>
                ))}
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1A5C2E]/35 bg-white/35 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-700">{emptyState.title}</p>
                <p className="mt-1 text-xs text-slate-500">{emptyState.description}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredShops.map((shop) => {
                  const coverUrl = shop.imageUrls?.[0] ?? '';
                  const hasImage = typeof coverUrl === 'string' && coverUrl.trim().length > 0;
                  const safeRating = Number.isFinite(shop.rating) ? Math.max(0, Math.min(5, shop.rating)) : 0;
                  const rFull = Math.floor(safeRating);
                  const rHalf = safeRating - rFull >= 0.5;
                  const rEmpty = 5 - rFull - (rHalf ? 1 : 0);

                  return (
                    <Link
                      key={shop.id}
                      href={`/${locale}/shop/${shop.id}`}
                      className="block w-full rounded-2xl bg-white/40 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                          {hasImage ? (
                            <Image src={coverUrl} alt={shop.name} width={56} height={56} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[rgba(26,92,46,0.12)]">
                              <svg viewBox="0 0 120 80" className="h-5 w-7 text-[#1A5C2E]/40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 33L20 18H100L106 33" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                                <path d="M18 33H102V64H18V33Z" stroke="currentColor" strokeWidth="6" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#0d2918]">{shop.name}</p>
                            <span className="shrink-0 rounded-xl bg-[rgba(26,92,46,0.10)] px-2 py-0.5 text-[11px] font-semibold text-[#1A5C2E]">
                              {shop.ratingLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[#1A5C2E]/80">
                            <PlaceTypeBadge place={shop} />
                            <span className="mx-1 text-[#1A5C2E]/30">|</span>
                            {formatPlacePrice(shop)}
                          </p>

                          <div className="mt-1 flex items-center gap-1">
                            <div className="flex items-center gap-px">
                              {Array.from({length: rFull}).map((_, i) => (
                                <Star key={`sf-${i}`} className="h-3 w-3 fill-amber-400 text-amber-400" />
                              ))}
                              {rHalf && <StarHalf className="h-3 w-3 fill-amber-400 text-amber-400" />}
                              {Array.from({length: rEmpty}).map((_, i) => (
                                <Star key={`se-${i}`} className="h-3 w-3 text-slate-300" />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-[#0d2918]">{safeRating.toFixed(1)}</span>
                            <span className="text-[11px] text-[#1A5C2E]/60">({tShopDetail('reviewsCount', {count: shop.reviews})})</span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                            <button
                              type="button"
                              onClick={() => handleLocateWithHighlight(shop.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1A5C2E]/70 transition active:text-[#1A5C2E]"
                            >
                              <Navigation className="h-3 w-3" />
                              {tShopDetail('viewLocation')}
                            </button>
                            {onToggleFavorite && (
                              <button
                                type="button"
                                onClick={(e) => onToggleFavorite(shop.id, e)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                  favorites?.includes(shop.id)
                                    ? 'bg-rose-500 text-white'
                                    : 'border border-rose-200 bg-white/70 text-rose-600'
                                }`}
                              >
                                {favorites?.includes(shop.id) ? tHome('mobile.favorited') : tHome('mobile.favorite')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
      </div>

    </>
  );
}
