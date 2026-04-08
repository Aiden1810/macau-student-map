'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import ContributionForm from '@/components/ContributionForm';
import FilterBar, {L2_TAGS} from '@/components/FilterBar';
import Header from '@/components/Header';
import MapPlaceholder from '@/components/MapPlaceholder';
import ShopList from '@/components/ShopList';
import {mapShopList} from '@/lib/mappers/shop';
import {supabase} from '@/lib/supabase';
import {useFavorites} from '@/lib/hooks/useFavorites';
import {DrawerFiltersState, Shop, ShopCategoryKey, ShopRegion, ViewMode} from '@/types/shop';

const DEFAULT_DRAWER_FILTERS: DrawerFiltersState = {
  shopType: '全部',
  ratingLabel: null,
  features: []
};

function hasDrawerFilters(filters: DrawerFiltersState): boolean {
  return filters.shopType !== '全部' || filters.ratingLabel !== null || filters.features.length > 0;
}

const L1_LABELS: Record<ShopCategoryKey, string> = {
  all: '全部',
  food: '美食',
  drink: '饮品/甜点',
  vibe: '场景',
  region: '区域',
  deal: '优惠',
  review: '榜单'
};

const SCENARIO_SHORTCUTS: Array<{
  key: 'student-deal' | 'top-rated' | 'delivery' | 'new-shop';
  label: string;
  helper: string;
}> = [
  {key: 'student-deal', label: '💰 学生党必看', helper: '学生价 / 有折扣'},
  {key: 'top-rated', label: '🏆 闭眼冲', helper: '封神之作 / 强推'},
  {key: 'delivery', label: '🛵 外卖宅家', helper: '外卖可达'},
  {key: 'new-shop', label: '🆕 新店尝鲜', helper: '本周新上'}
];

function filterByL1(tabKey: ShopCategoryKey, shops: Shop[]): Shop[] {
  if (tabKey === 'all' || tabKey === 'region') return shops;
  
  if (tabKey === 'review') {
    return shops.filter((s) => ['封神之作', '强烈推荐'].includes(s.ratingLabel));
  }

  if (tabKey === 'deal') {
    const dealTags = Object.values(L2_TAGS.deal || {}).flat();
    return shops.filter(
      (s) =>
        s.category === 'deal' ||
        s.features.includes('有折扣') ||
        s.features.includes('学生价') ||
        s.tags.some((t) => dealTags.some((gt) => gt === t))
    );
  }

  if (tabKey === 'food' || tabKey === 'drink' || tabKey === 'vibe') {
    const groupTags = Object.values(L2_TAGS[tabKey]).flat();
    return shops.filter(
      (s) => s.category === tabKey || s.tags.some((t) => groupTags.some((gt) => gt === t))
    );
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
  const [activeScenario, setActiveScenario] = useState<null | 'student-deal' | 'top-rated' | 'delivery' | 'new-shop'>(null);
  const [activeRegion, setActiveRegion] = useState<ShopRegion | 'all'>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const {favorites, toggleFavorite, isLoaded} = useFavorites();
  const [selectedShopId, setSelectedShopId] = useState<Shop['id'] | null>(null);
  const [collapseMobileSheetSignal, setCollapseMobileSheetSignal] = useState(0);
  const [locateSignal, setLocateSignal] = useState(0);
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
          'id,name,category,student_discount,tags,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text,image_urls,address,main_category,sub_tags,price_per_person,region,signature_dish,sharp_review'
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
        : visibleShops.filter((shop) => {
            const searchPool = [
              shop.name,
              shop.address,
              shop.shopType,
              shop.mainCategory ?? '',
              ...shop.tags,
              ...(shop.subTags ?? [])
            ];

            return searchPool.some((value) => value.toLowerCase().includes(keyword));
          });

    const l1Filtered = filterByL1(activeL1, searched);
    const l2Filtered = activeL2 ? filterByL2(activeL2, l1Filtered) : l1Filtered;
    let drawerFiltered = applyDrawerFilters(l2Filtered, drawerFilters);

    if (showFavorites && isLoaded) {
      drawerFiltered = drawerFiltered.filter((shop) => favorites.includes(shop.id));
    }

    if (activeRegion !== 'all') {
      drawerFiltered = drawerFiltered.filter((shop) => shop.region === activeRegion);
    }

    if (!activeScenario) {
      return drawerFiltered;
    }

    if (activeScenario === 'student-deal') {
      return drawerFiltered.filter((shop) => shop.features.includes('学生价') || shop.features.includes('有折扣'));
    }

    if (activeScenario === 'delivery') {
      return drawerFiltered.filter((shop) => shop.features.includes('外卖可达'));
    }

    if (activeScenario === 'new-shop') {
      return drawerFiltered.filter((shop) => shop.tags.includes('本周新上') || shop.tags.includes('新店开业'));
    }

    return drawerFiltered.filter((shop) => ['封神之作', '强烈推荐'].includes(shop.ratingLabel));
  }, [activeL1, activeL2, activeScenario, drawerFilters, searchQuery, visibleShops, showFavorites, isLoaded, favorites, activeRegion]);

  const hasActiveTopFilters = activeL1 !== 'all' || activeL2 !== null;
  const hasActiveDrawerFilters = hasDrawerFilters(drawerFilters);
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasActiveScenarioFilter = activeScenario !== null;
  const hasActiveRegionFilter = activeRegion !== 'all';
  const hasActiveFavoriteFilter = showFavorites;
  const hasActiveFilters =
    hasActiveTopFilters ||
    hasActiveDrawerFilters ||
    hasActiveSearch ||
    hasActiveScenarioFilter ||
    hasActiveRegionFilter ||
    hasActiveFavoriteFilter;

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (showFavorites) {
      labels.push('我的收藏');
    }

    if (activeRegion !== 'all') {
      labels.push(`区域: ${activeRegion}`);
    }

    if (activeL1 !== 'all') {
      labels.push(`频道: ${L1_LABELS[activeL1]}`);
    }

    if (activeL2) {
      labels.push(`二级: ${activeL2}`);
    }

    if (drawerFilters.shopType !== '全部') {
      labels.push(`类型: ${drawerFilters.shopType}`);
    }

    if (drawerFilters.ratingLabel) {
      labels.push(`口碑: ${drawerFilters.ratingLabel}`);
    }

    if (drawerFilters.features.length > 0) {
      labels.push(...drawerFilters.features.map((feature) => `特色: ${feature}`));
    }

    if (hasActiveSearch) {
      labels.push(`搜索: ${searchQuery.trim()}`);
    }

    if (activeScenario) {
      const scenario = SCENARIO_SHORTCUTS.find((item) => item.key === activeScenario);
      if (scenario) {
        labels.push(`场景: ${scenario.label}`);
      }
    }

    return labels;
  }, [activeL1, activeL2, activeScenario, drawerFilters, hasActiveSearch, searchQuery]);

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
      // If we switch away from region tab, keep the activeRegion filter active (sticky)
      // but if we switch TO region tab, reset it unless we pick one? 
      // Actually, if they click "Region" tab, we show all initially in that tab context.
      if (l1 === 'region') {
         setActiveRegion('all');
      }
      return;
    }

    if (l1 === 'region') {
      setActiveRegion((l2 as ShopRegion) || 'all');
    }

    setActiveL1(l1);
    setActiveL2(l2);
  };

  const resetAllFiltersAndSearch = () => {
    setActiveL1('all');
    setActiveL2(null);
    setActiveScenario(null);
    setActiveRegion('all');
    setShowFavorites(false);
    setDrawerFilters(DEFAULT_DRAWER_FILTERS);
    setSearchQuery('');
  };

  const handleLocateShop = (shopId: Shop['id']): boolean => {
    const targetShop = displayedShops.find((shop) => shop.id === shopId);

    if (!targetShop?.hasCoordinates) {
      toast.error('该店铺暂无坐标，请先补充地址/经纬度');
      return false;
    }

    setSelectedShopId(shopId);
    setViewMode('map');
    setCollapseMobileSheetSignal((prev) => prev + 1);
    setLocateSignal((prev) => prev + 1);
    return true;
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
    <div className="min-h-[100dvh] text-slate-800 md:bg-slate-50">
      <div className="relative md:hidden">
        <div className="fixed inset-0 z-0 m-0 h-[100dvh] w-full p-0">
          <MapPlaceholder
            shops={displayedShops}
            activeL1={activeL1}
            selectedShopId={selectedShopId}
            locateSignal={locateSignal}
            onSelectShop={setSelectedShopId}
            contributionPickMode={mapPickMode}
            onPickCoordinates={(coords) => {
              setManualCoordinates(coords);
              setMapPickMode(false);
            }}
          />
        </div>

        <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col">
          <div className="pointer-events-auto rounded-b-[18px] bg-white px-[14px] pt-[max(env(safe-area-inset-top),4px)] pb-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <Header
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchPlaceholder={t('searchPlaceholder')}
              isAdmin={isAdmin}
              userEmail={userEmail}
              loginHref="/login"
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
          </div>

          <div className="pointer-events-auto px-[14px] pt-1">
            <FilterBar 
              activeL1={activeL1} 
              activeL2={activeL2} 
              onChange={handleTopFilterChange} 
            />
          </div>
        </div>

        {pageError && (
          <p className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-sm text-rose-700 shadow-sm">
            {pageError}
          </p>
        )}
        {pageNotice && (
          <p className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-700 shadow-sm">
            {pageNotice}
          </p>
        )}

        <ShopList
          filteredShops={displayedShops}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onLocateShop={handleLocateShop}
          mobileSearchPlaceholder={t('mobileSearchPlaceholder')}
          emptyText={t('emptyResult')}
          hasAnyShops={visibleShops.length > 0}
          hasActiveFilters={hasActiveFilters}
          activeFilterLabels={activeFilterLabels}
          onClearSearch={() => setSearchQuery('')}
          onClearAllFilters={resetAllFiltersAndSearch}
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
          activeScenario={activeScenario}
          onChangeActiveScenario={setActiveScenario}
          scenarioShortcuts={SCENARIO_SHORTCUTS}
          activeL1={activeL1}
          activeL2={activeL2}
          onL2Change={handleTopFilterChange}
          showFavorites={showFavorites}
          setShowFavorites={setShowFavorites}
          activeRegion={activeRegion}
          setActiveRegion={setActiveRegion}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <div className="hidden md:block">
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
            <FilterBar 
              activeL1={activeL1} 
              activeL2={activeL2} 
              onChange={handleTopFilterChange} 
            />
          </div>

          {isContributeOpen && (
            <div className="mt-2 max-h-[60dvh] overflow-y-auto">
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
            </div>
          )}


          <section className="mt-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm md:px-4 md:py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">场景快捷筛选</p>
              {activeScenario && (
                <button
                  type="button"
                  onClick={() => setActiveScenario(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  清除场景
                </button>
              )}
            </div>
            <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {SCENARIO_SHORTCUTS.map((scenario) => {
                const active = activeScenario === scenario.key;
                return (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() => setActiveScenario(active ? null : scenario.key)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? 'border-[#006633] bg-[#006633]/5 text-[#006633]'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-semibold">{scenario.label}</p>
                    <p className="text-[11px] opacity-80">{scenario.helper}</p>
                  </button>
                );
              })}
            </div>
          </section>

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
                activeL1={activeL1}
                selectedShopId={selectedShopId}
                locateSignal={locateSignal}
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
                mobileSearchPlaceholder={t('mobileSearchPlaceholder')}
                emptyText={t('emptyResult')}
                hasAnyShops={visibleShops.length > 0}
                hasActiveFilters={hasActiveFilters}
                activeFilterLabels={activeFilterLabels}
                onClearSearch={() => setSearchQuery('')}
                onClearAllFilters={resetAllFiltersAndSearch}
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
                activeScenario={activeScenario}
                onChangeActiveScenario={setActiveScenario}
                scenarioShortcuts={SCENARIO_SHORTCUTS}
                showFavorites={showFavorites}
                setShowFavorites={setShowFavorites}
                activeRegion={activeRegion}
                setActiveRegion={setActiveRegion}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </div>
        </main>
      </div>

      {isContributeOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[90] max-h-[90dvh] overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] md:hidden">
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
        </div>
      )}
    </div>
  );
}
