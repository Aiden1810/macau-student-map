import {Search} from 'lucide-react';
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
  return (
    <div
      className={`w-full md:w-5/12 lg:w-1/3 flex-col gap-4 ${viewMode === 'map' ? 'hidden md:flex' : 'flex'}`}
    >
      <div className="relative md:hidden mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={mobileSearchPlaceholder}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {filterLabelMap[filter]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2 transition-opacity duration-300">
        {loading ? (
          Array.from({length: 3}).map((_, index) => <ShopCardSkeleton key={`skeleton-${index}`} />)
        ) : (
          <div className="space-y-4 transition-opacity duration-300 opacity-100">
            {filteredShops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                onLocate={onLocateShop}
                canApprove={canApprove}
                approving={approvingShopId === shop.id}
                onApprove={onApproveShop}
                canDelete={canDelete}
                deleting={deletingShopId === shop.id}
                onDelete={onDeleteShop}
              />
            ))}
            {filteredShops.length === 0 && <div className="text-center py-10 text-slate-400">{emptyText}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
