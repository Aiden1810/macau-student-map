'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Link} from '@/i18n/navigation';
import ContributionForm from '@/components/ContributionForm';
import FilterBar, {L2_TAGS} from '@/components/FilterBar';
import Header from '@/components/Header';
import MapPlaceholder from '@/components/MapPlaceholder';
import ShopList from '@/components/ShopList';
import {mapShopList, mapSingleShop} from '@/lib/mappers/shop';
import {supabase} from '@/lib/supabase';
import {useFavorites} from '@/lib/hooks/useFavorites';
import {DrawerFiltersState, Shop, ShopCategoryKey, ShopRegion, ViewMode} from '@/types/shop';

function mergeShopUpdate(prev: Shop[], incoming: Shop): Shop[] {
  const index = prev.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [incoming, ...prev];

  const next = [...prev];
  next[index] = incoming;
  return next;
}

const DEFAULT_DRAWER_FILTERS: DrawerFiltersState = {
  shopType: '全部',
  ratingLabel: null,
  features: []
};

function hasDrawerFilters(filters: DrawerFiltersState): boolean {
  return filters.shopType !== '全部' || filters.ratingLabel !== null || filters.features.length > 0;
}

const SCENARIO_KEYS: Array<'student-deal' | 'top-rated' | 'delivery' | 'new-shop'> = [
  'student-deal',
  'top-rated',
  'delivery',
  'new-shop'
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

function filterByL2(tag: string, shops: Shop[], l1Key: ShopCategoryKey): Shop[] {
  if (l1Key === 'region') {
    return shops.filter((s) => s.region === tag);
  }

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
  const tFilters = useTranslations('Filters');
  const tHome = useTranslations('Home');
  const locale = useLocale() as 'zh-CN' | 'zh-MO' | 'en';

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

  const scenarioShortcuts = useMemo(
    () =>
      SCENARIO_KEYS.map((key) => ({
        key,
        label: tHome(`scenario.${key}.label`),
        helper: tHome(`scenario.${key}.helper`)
      })),
    [tHome]
  );

  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [manualCoordinates, setManualCoordinates] = useState<[number, number] | null>(null);

  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [showSubmissionFollowup, setShowSubmissionFollowup] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchShops = useCallback(async () => {
    setLoading(true);

    try {
      const statusFilter = userRole === 'admin' ? 'status.in.(pending,verified,rejected),status.is.null' : 'status.eq.verified';

      const {data, error} = await supabase
        .from('shops')
        .select(
          'id,name,name_i18n,category,student_discount,tags,tags_i18n,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text,review_text_i18n,image_urls,address,main_category,sub_tags,price_per_person,region,signature_dish,sharp_review'
        )
        .or(statusFilter);

      if (error) {
        console.error('Failed to fetch shops:', error.message);
        setShops([]);
        toast.error(tHome('toast.loadFailed'));
        return;
      }

      const mappedShops = mapShopList((data ?? []) as unknown[], locale);
      setShops(mappedShops);

      if (hasFetchedRef.current) {
        toast.success(tHome('toast.updated'));
      }

      hasFetchedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [locale, tHome, userRole]);

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

  useEffect(() => {
    const channel = supabase
      .channel(`shops-realtime-page-${userRole ?? 'guest'}`)
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'shops'},
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Record<string, unknown> | null;
            const deletedId = oldRow?.id ? String(oldRow.id) : null;
            if (!deletedId) return;

            setShops((prev) => prev.filter((shop) => shop.id !== deletedId));
            return;
          }

          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;

          const mapped = mapSingleShop(row, locale);

          if (userRole !== 'admin' && mapped.status !== 'verified') {
            setShops((prev) => prev.filter((shop) => shop.id !== mapped.id));
            return;
          }

          setShops((prev) => mergeShopUpdate(prev, mapped));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locale, userRole]);

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
    const l2Filtered = activeL2 ? filterByL2(activeL2, l1Filtered, activeL1) : l1Filtered;
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
      labels.push(tFilters('myFavorites'));
    }

    if (activeRegion !== 'all') {
      labels.push(`${tHome('activeFilter.areaPrefix')}: ${activeRegion}`);
    }

    if (activeL1 !== 'all') {
      labels.push(`${tHome('activeFilter.channelPrefix')}: ${tFilters(activeL1 === 'drink' ? 'drinksDesserts' : activeL1 === 'vibe' ? 'scenario' : activeL1 === 'region' ? 'area' : activeL1 === 'review' ? 'topPicks' : activeL1)}`);
    }

    if (activeL2) {
      labels.push(`${tHome('activeFilter.l2Prefix')}: ${activeL2}`);
    }

    if (drawerFilters.shopType !== '全部') {
      labels.push(`${tHome('activeFilter.typePrefix')}: ${drawerFilters.shopType}`);
    }

    if (drawerFilters.ratingLabel) {
      labels.push(`${tHome('activeFilter.ratingPrefix')}: ${drawerFilters.ratingLabel}`);
    }

    if (drawerFilters.features.length > 0) {
      labels.push(...drawerFilters.features.map((feature) => `${tHome('activeFilter.featurePrefix')}: ${feature}`));
    }

    if (hasActiveSearch) {
      labels.push(`${tHome('activeFilter.searchPrefix')}: ${searchQuery.trim()}`);
    }

    if (activeScenario) {
      const scenario = scenarioShortcuts.find((item) => item.key === activeScenario);
      if (scenario) {
        labels.push(`${tHome('activeFilter.scenarioPrefix')}: ${scenario.label}`);
      }
    }

    return labels;
  }, [activeL1, activeL2, activeScenario, activeRegion, drawerFilters, hasActiveSearch, scenarioShortcuts, searchQuery, showFavorites, tFilters, tHome]);

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
      toast.error(tHome('toast.noCoordinates'));
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

    const confirmed = window.confirm(tHome('confirm.deleteShop'));
    if (!confirmed) {
      return;
    }

    setDeletingShopId(shopId);
    setPageError(null);
    setPageNotice(null);

    const {data, error} = await supabase.from('shops').delete().eq('id', shopId).select('id');

    setDeletingShopId(null);

    if (error) {
      setPageError(`${tHome('errors.deleteFailed')}: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setPageError(tHome('errors.deleteNotEffective'));
      await fetchShops();
      return;
    }

    setShops((prev) => prev.filter((shop) => shop.id !== shopId));
    setPageNotice(tHome('toast.deleted'));
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
              userEmail={userEmail}
              loginHref="/login"
              mySubmissionsHref="/my-submissions"
              onLogout={handleLogout}
              onToggleContribute={() => {
                setIsContributeOpen((prev) => !prev);
                setMapPickMode(false);
                setManualCoordinates(null);
                setPageError(null);
                setPageNotice(null);
                setShowSubmissionFollowup(false);
              }}
              contributeLabel={tContribute('button')}
              mySubmissionsLabel={tContribute('mySubmissions')}
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
          <div className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 space-y-2">
            <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-700 shadow-sm">
              {pageNotice}
            </p>
            {showSubmissionFollowup && (
              <div className="pointer-events-auto rounded-xl border border-emerald-200/80 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                <p>{tContribute('submitFollowupHint')}</p>
                <Link href="/my-submissions" locale={locale} className="mt-1 inline-flex font-medium text-emerald-700 underline">
                  {tContribute('mySubmissions')}
                </Link>
              </div>
            )}
          </div>
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
          activeScenario={activeScenario}
          onChangeActiveScenario={setActiveScenario}
          scenarioShortcuts={scenarioShortcuts}
          activeL1={activeL1}
          activeL2={activeL2}
          onL2Change={handleTopFilterChange}
          showFavorites={showFavorites}
          setShowFavorites={setShowFavorites}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <div className="hidden md:block md:bg-slate-50">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder={t('searchPlaceholder')}
          userEmail={userEmail}
          loginHref="/login"
          mySubmissionsHref="/my-submissions"
          onLogout={handleLogout}
          onToggleContribute={() => {
            setIsContributeOpen((prev) => !prev);
            setMapPickMode(false);
            setManualCoordinates(null);
            setPageError(null);
            setPageNotice(null);
            setShowSubmissionFollowup(false);
          }}
          contributeLabel={tContribute('button')}
          mySubmissionsLabel={tContribute('mySubmissions')}
        />

        <main className="relative mx-auto max-w-[1380px] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:px-6 md:h-[calc(100dvh-4rem)] md:pb-4 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
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
                  setShowSubmissionFollowup(true);
                  setPageError(null);
                  setIsContributeOpen(false);
                  setMapPickMode(false);
                  setManualCoordinates(null);
                }}
              />
            </div>
          )}


          <section className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">{tHome('scenario.quickFilterTitle')}</p>
              {activeScenario && (
                <button
                  type="button"
                  onClick={() => setActiveScenario(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  {tHome('scenario.clearScenario')}
                </button>
              )}
            </div>
            <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {scenarioShortcuts.map((scenario) => {
                const active = activeScenario === scenario.key;
                return (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() => setActiveScenario(active ? null : scenario.key)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? 'border-[#006633] bg-[#006633]/5 text-[#006633] shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
            <div className="mb-4 space-y-2">
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">{pageNotice}</p>
              {showSubmissionFollowup && (
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                  <p>{tContribute('submitFollowupHint')}</p>
                  <Link href="/my-submissions" locale={locale} className="mt-1 inline-flex font-medium text-emerald-700 underline">
                    {tContribute('mySubmissions')}
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-0 md:h-[calc(100dvh-12.5rem)] md:grid-cols-12 md:gap-4 lg:gap-5">
            <div className="order-1 h-[58dvh] min-h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:order-2 md:col-span-8 md:h-full lg:col-span-8">
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

            <div className="order-2 min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:order-1 md:col-span-4 md:p-3.5 lg:col-span-4">
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
                activeScenario={activeScenario}
                onChangeActiveScenario={setActiveScenario}
                scenarioShortcuts={scenarioShortcuts}
                showFavorites={showFavorites}
                setShowFavorites={setShowFavorites}
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
              setShowSubmissionFollowup(true);
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
