'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import ContributionForm from '@/components/ContributionForm';
import FilterBar from '@/components/FilterBar';
import Header from '@/components/Header';
import MapPlaceholder from '@/components/MapPlaceholder';
import ShopList from '@/components/ShopList';
import {mapShopList} from '@/lib/mappers/shop';
import {supabase} from '@/lib/supabase';
import {DrawerFiltersState, Shop, ShopCategoryKey, ViewMode} from '@/types/shop';

const DEFAULT_DRAWER_FILTERS: DrawerFiltersState = {
  shopType: '全部',
  ratingLabel: null,
  features: []
};

function filterByL1(tabKey: ShopCategoryKey, shops: Shop[]): Shop[] {
  if (tabKey === 'all') return shops;

  if (tabKey === 'review') {
    return shops.filter((s) => ['封神之作', '强烈推荐'].includes(s.ratingLabel));
  }

  if (tabKey === 'deal') {
    return shops.filter((s) => s.features.includes('有折扣') || s.features.includes('学生价'));
  }

  return shops.filter((s) => s.category === tabKey);
}

function filterByL2(tag: string, shops: Shop[]): Shop[] {
  return shops.filter((s) => s.tags.includes(tag));
}

function applyDrawerFilters(shops: Shop[], drawerFilters: DrawerFiltersState): Shop[] {
  let result = shops;

  if (drawerFilters.shopType !== '全部') {
    result = result.filter((s) => s.shopType === drawerFilters.shopType);
  }

  if (drawerFilters.ratingLabel) {
    result = result.filter((s) => s.ratingLabel === drawerFilters.ratingLabel);
  }

  if (drawerFilters.features.length > 0) {
    result = result.filter((s) => drawerFilters.features.every((f) => s.features.includes(f)));
  }

  return result;
}

export default function Page() {
  const t = useTranslations('Common');
  const tContribute = useTranslations('Contribute');
  const tShopCard = useTranslations('ShopCard');

  const [, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeL1, setActiveL1] = useState<ShopCategoryKey>('all');
  const [activeL2, setActiveL2] = useState<string | null>(null);
  const [drawerFilters, setDrawerFilters] = useState<DrawerFiltersState>(DEFAULT_DRAWER_FILTERS);
  const [selectedShopId, setSelectedShopId] = useState<Shop['id'] | null>(null);
  const [hoveredShopId, setHoveredShopId] = useState<Shop['id'] | null>(null);
  const [collapseMobileSheetSignal, setCollapseMobileSheetSignal] = useState(0);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [approvingShopId, setApprovingShopId] = useState<Shop['id'] | null>(null);
  const [deletingShopId, setDeletingShopId] = useState<Shop['id'] | null>(null);

  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [manualCoordinates, setManualCoordinates] = useState<[number, number] | null>(null);

  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchShops = useCallback(async () => {
    setLoading(true);

    try {
      const statusFilter = userRole === 'admin' ? 'status.in.(pending,verified,rejected),status.is.null' : 'status.eq.verified';

      const {data, error} = await supabase
        .from('shops')
        .select(
          'id,name,category,student_discount,tags,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text,image_urls,address,main_category,sub_tags'
        )
        .or(statusFilter);

      if (error) {
        console.error('Failed to fetch shops:', error.message);
        setShops([]);
        toast.error('加载失败，请检查网络');
        return;
      }

      const mappedShops = mapShopList((data ?? []) as unknown[]);
      setShops(mappedShops);

      if (hasFetchedRef.current) {
        toast.success('已更新点位');
      }

      hasFetchedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  const fetchCurrentUserRole = useCallback(async () => {
    const {data: authData, error: authError} = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setUserRole(null);
      setUserEmail(null);
      return;
    }

    setUserEmail(authData.user.email ?? null);

    const {data: profile, error: profileError} = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch profile role:', profileError.message);
      setUserRole(null);
      return;
    }

    setUserRole(profile?.role ?? null);
  }, []);

  useEffect(() => {
    fetchCurrentUserRole();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange(() => {
      fetchCurrentUserRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchCurrentUserRole]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const isAdmin = userRole === 'admin';
  const visibleShops = isAdmin ? shops : shops.filter((shop) => shop.status === 'verified');

  const displayedShops = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const searched =
      keyword.length === 0
        ? visibleShops
        : visibleShops.filter((shop) => [shop.name, ...shop.tags].some((value) => value.toLowerCase().includes(keyword)));

    const l1Filtered = filterByL1(activeL1, searched);
    const l2Filtered = activeL2 ? filterByL2(activeL2, l1Filtered) : l1Filtered;

    return applyDrawerFilters(l2Filtered, drawerFilters);
  }, [activeL1, activeL2, drawerFilters, searchQuery, visibleShops]);

  useEffect(() => {
    if (displayedShops.length === 0) {
      setSelectedShopId(null);
      return;
    }

    const stillExists = displayedShops.some((shop) => shop.id === selectedShopId);
    if (!stillExists) {
      setSelectedShopId(null);
    }
  }, [displayedShops, selectedShopId]);

  const handleTopFilterChange = (l1: ShopCategoryKey, l2: string | null) => {
    if (l1 !== activeL1) {
      setActiveL1(l1);
      setActiveL2(null);
      setDrawerFilters(DEFAULT_DRAWER_FILTERS);
      return;
    }

    setActiveL1(l1);
    setActiveL2(l2);
  };

  const handleLocateShop = (shopId: Shop['id']) => {
    setSelectedShopId(shopId);
    setViewMode('map');
    setCollapseMobileSheetSignal((prev) => prev + 1);
  };

  const handleApproveShop = async (shopId: Shop['id']) => {
    if (userRole !== 'admin' || approvingShopId) {
      return;
    }

    setApprovingShopId(shopId);
    setPageError(null);
    setPageNotice(null);

    const {error} = await supabase.from('shops').update({status: 'verified'}).eq('id', shopId);

    setApprovingShopId(null);

    if (error) {
      setPageError(`${tShopCard('approveFailed')}: ${error.message}`);
      return;
    }

    setPageNotice(tShopCard('approveSuccess'));
    await fetchShops();
  };

  const handleDeleteShop = async (shopId: Shop['id']) => {
    if (userRole !== 'admin' || deletingShopId) {
      return;
    }

    const confirmed = window.confirm('确定要永久删除该店铺及其所有相关评论吗？');
    if (!confirmed) {
      return;
    }

    setDeletingShopId(shopId);
    setPageError(null);
    setPageNotice(null);

    const {data, error} = await supabase.from('shops').delete().eq('id', shopId).select('id');

    setDeletingShopId(null);

    if (error) {
      setPageError(`删除失败: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setPageError('删除未生效：请检查 Supabase RLS 的 DELETE 权限策略。');
      await fetchShops();
      return;
    }

    setShops((prev) => prev.filter((shop) => shop.id !== shopId));
    setPageNotice('店铺已删除');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setUserEmail(null);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder={t('searchPlaceholder')}
        isAdmin={isAdmin}
        userEmail={userEmail}
        loginHref="/admin-login"
        onLogout={handleLogout}
        onToggleContribute={() => {
          setIsContributeOpen((prev) => !prev);
          setMapPickMode(false);
          setManualCoordinates(null);
          setPageError(null);
          setPageNotice(null);
        }}
        contributeLabel={tContribute('button')}
      />

      <main className="relative mx-auto max-w-7xl px-4 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] sm:px-6 sm:pt-2 md:h-[calc(100dvh-4rem)] md:pb-4 lg:px-8">
        <div className="mb-0">
          <FilterBar activeL1={activeL1} activeL2={activeL2} onChange={handleTopFilterChange} />
        </div>

        {isContributeOpen && (
          <ContributionForm
            manualCoordinates={manualCoordinates}
            onRequestMapPick={() => {
              setMapPickMode(true);
              setViewMode('map');
            }}
            onCancel={() => {
              setIsContributeOpen(false);
              setMapPickMode(false);
              setManualCoordinates(null);
            }}
            onSuccess={async () => {
              await fetchShops();
              setPageNotice(tContribute('submitSuccess'));
              setPageError(null);
              setIsContributeOpen(false);
              setMapPickMode(false);
              setManualCoordinates(null);
            }}
          />
        )}

        {pageError && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-sm">{pageError}</p>
        )}
        {pageNotice && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">{pageNotice}</p>
        )}

        <div className="grid grid-cols-1 gap-0 md:h-[calc(100dvh-11rem)] md:grid-cols-12 md:gap-6">
          <div className="order-1 h-[58dvh] min-h-[360px] md:order-2 md:col-span-8 md:h-full lg:col-span-8">
            <MapPlaceholder
              shops={displayedShops}
              selectedShopId={selectedShopId}
              hoveredShopId={hoveredShopId}
              onSelectShop={setSelectedShopId}
              contributionPickMode={mapPickMode}
              onPickCoordinates={(coords) => {
                setManualCoordinates(coords);
                setMapPickMode(false);
              }}
            />
          </div>

          <div className="order-2 min-h-0 md:order-1 md:col-span-4 lg:col-span-4">
            <ShopList
              filteredShops={displayedShops}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onLocateShop={handleLocateShop}
              onHoverShop={setHoveredShopId}
              mobileSearchPlaceholder={t('mobileSearchPlaceholder')}
              emptyText={t('emptyResult')}
              canApprove={isAdmin}
              approvingShopId={approvingShopId}
              onApproveShop={handleApproveShop}
              canDelete={isAdmin}
              deletingShopId={deletingShopId}
              onDeleteShop={handleDeleteShop}
              collapseMobileSheetSignal={collapseMobileSheetSignal}
              drawerFilters={drawerFilters}
              onChangeDrawerFilters={setDrawerFilters}
              onResetDrawerFilters={() => setDrawerFilters(DEFAULT_DRAWER_FILTERS)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
