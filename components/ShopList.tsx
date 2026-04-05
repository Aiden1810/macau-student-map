import {ChevronDown, Search, SlidersHorizontal} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import ShopCard from '@/components/ShopCard';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import {DrawerFiltersState, FILTERABLE_RATING_LABELS, Shop, SHOP_DRAWER_TYPES, SHOP_FEATURE_OPTIONS} from '@/types/shop';

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

interface ShopListProps {
  filteredShops: Shop[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onLocateShop: (shopId: Shop['id']) => boolean;
  onHoverShop?: (shopId: Shop['id'] | null) => void;
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
}

export default function ShopList({
  filteredShops,
  loading,
  searchQuery,
  setSearchQuery,
  onLocateShop,
  onHoverShop,
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
  onResetDrawerFilters
}: ShopListProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(0);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  const [recentlyLocatedShopId, setRecentlyLocatedShopId] = useState<Shop['id'] | null>(null);
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

  const MIN_HEIGHT = 130;
  const MAX_HEIGHT = 84;

  const getExpandedHeightPx = () => window.innerHeight * (MAX_HEIGHT / 100);

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartHeightRef.current = mobileExpanded ? getExpandedHeightPx() : MIN_HEIGHT;
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;

    const delta = dragStartYRef.current - clientY;
    const next = Math.max(MIN_HEIGHT, Math.min(getExpandedHeightPx(), dragStartHeightRef.current + delta));
    setMobileHeight(next);
  };

  const endDrag = () => {
    if (dragStartYRef.current === null) return;

    const threshold = window.innerHeight * 0.45;
    const finalHeight = mobileHeight || (mobileExpanded ? getExpandedHeightPx() : MIN_HEIGHT);
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

  const mobileSelectedFilterCount = useMemo(() => {
    return activeFilterLabels.length + (searchQuery.trim().length > 0 ? 1 : 0);
  }, [activeFilterLabels, searchQuery]);

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

  const listContent = (
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
              <div
                key={shop.id}
                onMouseEnter={() => onHoverShop?.(shop.id)}
                onMouseLeave={() => onHoverShop?.(null)}
                onClick={() => onHoverShop?.(shop.id)}
              >
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
      <div className="hidden w-full flex-col gap-4 md:flex">{listContent}</div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md transition-[height] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden"
        style={{height: mobileHeight > 0 ? `${mobileHeight}px` : mobileExpanded ? '84dvh' : '130px'}}
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
          className="mx-auto mb-2 block h-1.5 w-12 touch-none rounded-full bg-slate-300"
        />

        {!mobileExpanded ? (
          <button
            type="button"
            onClick={() => setMobileExpanded(true)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-left"
          >
            <p className="text-sm font-semibold text-slate-700">附近店铺</p>
            <p className="mt-0.5 text-xs text-slate-500">共 {filteredShops.length} 家，点击查看完整列表</p>
            {mobileSelectedFilterCount > 0 && (
              <p className="mt-1 text-[11px] font-medium text-[#006633]">已选 {mobileSelectedFilterCount} 项筛选条件</p>
            )}
          </button>
        ) : (
          <div className="flex h-[calc(100%-1.75rem)] flex-col">{listContent}</div>
        )}
      </div>
    </>
  );
}
