import Image from 'next/image';
import {ChevronDown, MessageCircle, Navigation, Search, SlidersHorizontal, Star, StarHalf} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {L2_TAGS} from '@/components/FilterBar';
import MobileShopDetailModal from '@/components/MobileShopDetailModal';
import ShopCard from '@/components/ShopCard';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import {DrawerFiltersState, FILTERABLE_RATING_LABELS, Shop, ShopCategoryKey, SHOP_DRAWER_TYPES, SHOP_FEATURE_OPTIONS} from '@/types/shop';

const DRAWER_FILTERS = {
  shopType: {
    label: '类型',
    options: SHOP_DRAWER_TYPES
  },
  ratingLabel: {
    label: '口碑',
    options: FILTERABLE_RATING_LABELS
  },
  features: {
    label: '特色',
    options: SHOP_FEATURE_OPTIONS
  }
} as const;

interface ScenarioShortcut {
  key: 'student-deal' | 'top-rated' | 'delivery' | 'new-shop';
  label: string;
  helper: string;
}

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
  drawerFilters: DrawerFiltersState;
  onChangeDrawerFilters: (next: DrawerFiltersState) => void;
  onResetDrawerFilters: () => void;
  activeScenario?: ScenarioShortcut['key'] | null;
  onChangeActiveScenario?: (next: ScenarioShortcut['key'] | null) => void;
  scenarioShortcuts?: ScenarioShortcut[];
  activeL1?: ShopCategoryKey;
  activeL2?: string | null;
  onL2Change?: (l1: ShopCategoryKey, l2: string | null) => void;
}

const SHEET_COLLAPSED_HEIGHT = 215;
const SHEET_EXPANDED_VH = 85;

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
  drawerFilters,
  onChangeDrawerFilters,
  onResetDrawerFilters,
  activeScenario = null,
  onChangeActiveScenario,
  scenarioShortcuts = [],
  activeL1 = 'all',
  activeL2 = null,
  onL2Change
}: ShopListProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(0);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  const [recentlyLocatedShopId, setRecentlyLocatedShopId] = useState<Shop['id'] | null>(null);
  const [mobileDetailShop, setMobileDetailShop] = useState<Shop | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef<number>(0);
  const locateHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMobileExpanded(false);
    setMobileHeight(0);
    setIsMobileFilterExpanded(false);
  }, [collapseMobileSheetSignal]);

  useEffect(() => {
    return () => {
      if (locateHighlightTimerRef.current) {
        clearTimeout(locateHighlightTimerRef.current);
      }
    };
  }, []);

  const getExpandedHeightPx = () => window.innerHeight * (SHEET_EXPANDED_VH / 100);

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartHeightRef.current = mobileExpanded ? getExpandedHeightPx() : SHEET_COLLAPSED_HEIGHT;
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;

    const delta = dragStartYRef.current - clientY;
    const next = Math.max(SHEET_COLLAPSED_HEIGHT, Math.min(getExpandedHeightPx(), dragStartHeightRef.current + delta));
    setMobileHeight(next);
  };

  const endDrag = () => {
    if (dragStartYRef.current === null) return;

    const threshold = window.innerHeight * 0.55;
    const finalHeight = mobileHeight || (mobileExpanded ? getExpandedHeightPx() : SHEET_COLLAPSED_HEIGHT);
    setMobileExpanded(finalHeight >= threshold);
    setMobileHeight(0);
    dragStartYRef.current = null;
  };

  const emptyState = useMemo(() => {
    if (!hasAnyShops) {
      return {
        title: '还没有店铺数据',
        description: '你目前是空库状态，后续添加店铺后会在这里展示。可以先通过投稿或管理员后台新增第一批店铺。',
        actionLabel: null as string | null,
        action: null as (() => void) | null
      };
    }

    if (hasActiveFilters || searchQuery.trim().length > 0) {
      return {
        title: '没有匹配结果',
        description: '请尝试放宽筛选条件，或清除搜索关键词后重试。',
        actionLabel: '清空搜索与筛选',
        action: onClearAllFilters
      };
    }

    return {
      title: '暂无可展示店铺',
      description: emptyText,
      actionLabel: null as string | null,
      action: null as (() => void) | null
    };
  }, [emptyText, hasActiveFilters, hasAnyShops, onClearAllFilters, searchQuery]);

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

  const desktopListContent = (
    <>
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
            清除
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileFilterExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 md:pointer-events-none"
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-500 md:hidden" />
            筛选
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform md:hidden ${isMobileFilterExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          <button type="button" onClick={onResetDrawerFilters} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            重置
          </button>
        </div>

        <div className={`space-y-3 ${isMobileFilterExpanded ? 'block' : 'hidden md:block'}`}>
          {activeFilterLabels.length > 0 && (
            <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
              <p className="mb-1 text-[11px] font-semibold text-emerald-800">当前条件</p>
              <div className="flex flex-wrap gap-1.5">
                {activeFilterLabels.map((label) => (
                  <span key={label} className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">{DRAWER_FILTERS.shopType.label}</p>
            <div className="flex flex-wrap gap-2">
              {DRAWER_FILTERS.shopType.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChangeDrawerFilters({...drawerFilters, shopType: option})}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    drawerFilters.shopType === option
                      ? 'border-[#006633] bg-[#006633] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">{DRAWER_FILTERS.ratingLabel.label}</p>
            <div className="flex flex-wrap gap-2">
              {DRAWER_FILTERS.ratingLabel.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChangeDrawerFilters({
                      ...drawerFilters,
                      ratingLabel: drawerFilters.ratingLabel === option ? null : option
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    drawerFilters.ratingLabel === option
                      ? 'border-[#006633] bg-[#006633] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">{DRAWER_FILTERS.features.label}</p>
            <div className="flex flex-wrap gap-2">
              {DRAWER_FILTERS.features.options.map((option) => {
                const checked = drawerFilters.features.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      const nextFeatures = checked
                        ? drawerFilters.features.filter((f) => f !== option)
                        : [...drawerFilters.features, option];
                      onChangeDrawerFilters({...drawerFilters, features: nextFeatures});
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      checked ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
        {loading ? (
          Array.from({length: 6}).map((_, index) => <ShopCardSkeleton key={`skeleton-${index}`} />)
        ) : (
          <div className="space-y-4">
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
      <div className="hidden w-full flex-col gap-4 md:flex">{desktopListContent}</div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[26px] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.65rem)] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-[height] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden"
        style={{height: mobileHeight > 0 ? `${mobileHeight}px` : mobileExpanded ? `${SHEET_EXPANDED_VH}dvh` : `${SHEET_COLLAPSED_HEIGHT}px`, ...MOBILE_GLASS_STYLE}}
      >
        <button
          type="button"
          aria-label="展开店铺抽屉"
          onClick={() => setMobileExpanded((prev) => !prev)}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          onMouseDown={(e) => startDrag(e.clientY)}
          onMouseMove={(e) => moveDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          className="mx-auto mb-2 block h-1 w-[34px] touch-none rounded-[2px] bg-[#1A5C2E]/35"
        />

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1A5C2E]/75" />
          <input
            type="text"
            placeholder="搜索店铺、美食、地点…"
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
              清除
            </button>
          )}
        </div>

        {/* L2 sub-tags strip — shown in drawer when a category is selected */}
        {activeL1 !== 'all' && onL2Change && (() => {
          const groupMap = (L2_TAGS as Partial<Record<Exclude<ShopCategoryKey, 'all'>, Record<string, readonly string[]>>>)[activeL1 as Exclude<ShopCategoryKey, 'all'>] ?? {};
          const allTags = Object.values(groupMap).flat();
          if (allTags.length === 0) return null;
          return (
            <div className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {allTags.map((tag) => {
                const isActive = activeL2 === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onL2Change(activeL1, isActive ? null : tag)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'bg-[#006633] text-white'
                        : 'bg-white/60 text-[#0d2918]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          );
        })()}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0d2918]">场景筛选</p>
          <span className="rounded-2xl bg-[rgba(26,92,46,0.10)] px-2.5 py-1 text-xs font-semibold text-[#1A5C2E]">附近 {filteredShops.length} 家</span>
        </div>

        <div className="hide-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {scenarioShortcuts.map((scenario) => {
            const active = activeScenario === scenario.key;
            return (
              <button
                key={scenario.key}
                type="button"
                onClick={() => onChangeActiveScenario?.(active ? null : scenario.key)}
                className={`min-w-[94px] rounded-[13px] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-[16px] [backdrop-filter:blur(16px)_saturate(1.6)] ${
                  active
                    ? 'bg-[rgba(22,80,38,0.14)] text-[#0d2918] ring-1 ring-[rgba(26,92,46,0.25)]'
                    : 'bg-[rgba(255,255,255,0.45)] text-[#0d2918]'
                }`}
              >
                <p className="text-xs font-semibold">{scenario.label}</p>
                <p className="mt-0.5 text-[11px] opacity-80">{scenario.helper}</p>
              </button>
            );
          })}
        </div>

        {!mobileExpanded ? (
          <button
            type="button"
            onClick={() => setMobileExpanded(true)}
            className="w-full rounded-2xl bg-white/25 px-3 py-2 text-left"
          >
            <p className="text-sm font-semibold text-[#0d2918]">上拉查看附近店铺列表</p>
            <p className="mt-0.5 text-xs text-[#1A5C2E]/80">当前共 {filteredShops.length} 家</p>
          </button>
        ) : (
          <div className="mt-1 h-[calc(100%-145px)] overflow-y-auto">
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
                    <div
                      key={shop.id}
                      className="w-full rounded-2xl bg-white/40 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Thumbnail */}
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                          {hasImage ? (
                            <Image
                              src={coverUrl}
                              alt={shop.name}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[rgba(26,92,46,0.12)]">
                              <svg viewBox="0 0 120 80" className="h-5 w-7 text-[#1A5C2E]/40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 33L20 18H100L106 33" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                                <path d="M18 33H102V64H18V33Z" stroke="currentColor" strokeWidth="6" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#0d2918]">{shop.name}</p>
                            <span className="shrink-0 rounded-xl bg-[rgba(26,92,46,0.10)] px-2 py-0.5 text-[11px] font-semibold text-[#1A5C2E]">
                              {shop.ratingLabel}
                            </span>
                          </div>
                          <p className="truncate text-xs text-[#1A5C2E]/80 mt-0.5">{shop.shopType}</p>

                          {/* Stars */}
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
                            <span className="text-[11px] text-[#1A5C2E]/60">({shop.reviews}条评论)</span>
                          </div>

                          {/* Actions */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobileDetailShop(shop);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[rgba(26,92,46,0.20)] bg-[rgba(26,92,46,0.06)] px-2 py-1 text-[11px] font-semibold text-[#1A5C2E] transition active:bg-[rgba(26,92,46,0.12)]"
                            >
                              <MessageCircle className="h-3 w-3" />
                              查看评论
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLocateWithHighlight(shop.id);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1A5C2E]/70 transition active:text-[#1A5C2E]"
                            >
                              <Navigation className="h-3 w-3" />
                              查看位置
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {mobileDetailShop && (
        <MobileShopDetailModal
          shop={mobileDetailShop}
          open={!!mobileDetailShop}
          onClose={() => setMobileDetailShop(null)}
          onLocate={(shopId) => {
            handleLocateWithHighlight(shopId);
          }}
        />
      )}
    </>
  );
}
