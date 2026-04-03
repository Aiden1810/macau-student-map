import {Search} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import ShopCard from '@/components/ShopCard';
import ShopCardSkeleton from '@/components/ShopCardSkeleton';
import {FilterOption, Shop, ViewMode} from '@/types/shop';

interface ShopListProps {
  filters: FilterOption[];
  activeFilter: FilterOption;
  setActiveFilter: (filter: FilterOption) => void;
  filteredShops: Shop[];
  loading: boolean;
  viewMode: ViewMode;
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

const SHEET_COLLAPSED = 35;
const SHEET_EXPANDED = 86;

export default function ShopList({
  filters,
  activeFilter,
  setActiveFilter,
  filteredShops,
  loading,
  viewMode,
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
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const startExpandedRef = useRef(false);

  const sheetHeight = useMemo(() => (sheetExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED), [sheetExpanded]);

  useEffect(() => {
    setSheetExpanded(false);
    setDragOffset(0);
    setDragging(false);
    startYRef.current = null;
  }, [collapseMobileSheetSignal]);

  const startDrag = (clientY: number) => {
    startYRef.current = clientY;
    startExpandedRef.current = sheetExpanded;
    setDragging(true);
  };

  const moveDrag = (clientY: number) => {
    if (startYRef.current === null) return;
    const deltaY = clientY - startYRef.current;
    const base = startExpandedRef.current ? SHEET_EXPANDED : SHEET_COLLAPSED;
    const offset = (-deltaY / window.innerHeight) * 100;
    const nextHeight = Math.max(SHEET_COLLAPSED, Math.min(SHEET_EXPANDED, base + offset));
    setDragOffset(nextHeight - base);
  };

  const endDrag = () => {
    if (startYRef.current === null) return;
    const threshold = 8;
    if (dragOffset > threshold) {
      setSheetExpanded(true);
    } else if (dragOffset < -threshold) {
      setSheetExpanded(false);
    }
    setDragging(false);
    setDragOffset(0);
    startYRef.current = null;
  };

  const sheetStyle = {
    height: `${sheetHeight + dragOffset}dvh`
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

      <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
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
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border border-slate-200 bg-white/85 p-3 shadow-2xl backdrop-blur-md transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden"
        style={sheetStyle}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="拖动店铺抽屉"
          onMouseDown={(e) => startDrag(e.clientY)}
          onMouseMove={(e) => dragging && moveDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          onClick={() => setSheetExpanded((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSheetExpanded((prev) => !prev);
            }
          }}
          className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-slate-300"
        />

        <div className="flex h-[calc(100%-1.25rem)] flex-col">{listContent}</div>
      </div>
    </>
  );
}
