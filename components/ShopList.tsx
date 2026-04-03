import {Search} from 'lucide-react';
import {useMemo, useState} from 'react';
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
}

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
  onDeleteShop
}: ShopListProps) {
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const sheetHeightClass = useMemo(() => (sheetExpanded ? 'h-[82dvh]' : 'h-[35dvh]'), [sheetExpanded]);

  const listContent = (
    <>
      <div className="relative md:hidden mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={mobileSearchPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] focus:border-[#006633]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {loading ? (
          Array.from({length: 3}).map((_, index) => <ShopCardSkeleton key={`skeleton-${index}`} />)
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
      <div className={`hidden w-full flex-col gap-4 md:flex ${viewMode === 'map' ? '' : ''}`}>
        {listContent}
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border border-slate-200 bg-white/80 p-3 shadow-2xl backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden ${sheetHeightClass}`}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((prev) => !prev)}
          className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-slate-300"
          aria-label="Toggle shop list drawer"
        />

        <div className="flex h-[calc(100%-1.25rem)] flex-col">{listContent}</div>
      </div>
    </>
  );
}
