import {Search} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import ShopCard from '@/components/ShopCard';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import {FilterOption, Shop} from '@/types/shop';

interface ShopListProps {
  filters: FilterOption[];
  activeFilter: FilterOption;
  setActiveFilter: (filter: FilterOption) => void;
  filteredShops: Shop[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onLocateShop: (shopId: Shop['id']) => void;
  onHoverShop?: (shopId: Shop['id'] | null) => void;
  mobileSearchPlaceholder: string;
  emptyText: string;
  filterLabelMap: Record<FilterOption, string>;
  canApprove: boolean;
  approvingShopId: Shop['id'] | null;
  onApproveShop: (shopId: Shop['id']) => void;
  canDelete: boolean;
  deletingShopId: Shop['id'] | null;
  onDeleteShop: (shopId: Shop['id']) => void;
  collapseMobileSheetSignal?: number;
}

export default function ShopList({
  filters,
  activeFilter,
  setActiveFilter,
  filteredShops,
  loading,
  searchQuery,
  setSearchQuery,
  onLocateShop,
  onHoverShop,
  mobileSearchPlaceholder,
  emptyText,
  filterLabelMap,
  canApprove,
  approvingShopId,
  onApproveShop,
  canDelete,
  deletingShopId,
  onDeleteShop,
  collapseMobileSheetSignal = 0
}: ShopListProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef<number>(0);

  useEffect(() => {
    setMobileExpanded(false);
    setMobileHeight(0);
  }, [collapseMobileSheetSignal]);

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

  const listContent = (
    <>
      <div className="mb-2 relative md:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={mobileSearchPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] focus:border-[#006633]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              activeFilter === filter
                ? 'bg-[#006633] text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filterLabelMap[filter]}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
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
                  onLocate={onLocateShop}
                  canApprove={canApprove}
                  approving={approvingShopId === shop.id}
                  onApprove={onApproveShop}
                  canDelete={canDelete}
                  deleting={deletingShopId === shop.id}
                  onDelete={onDeleteShop}
                />
              </div>
            ))}
            {filteredShops.length === 0 && <div className="py-10 text-center text-slate-400">{emptyText}</div>}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="hidden w-full flex-col gap-4 md:flex">{listContent}</div>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md transition-[height] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden`}
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
          </button>
        ) : (
          <div className="flex h-[calc(100%-1.75rem)] flex-col">{listContent}</div>
        )}
      </div>
    </>
  );
}
