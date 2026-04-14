'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Link} from '@/i18n/navigation';
import ContributionForm from '@/components/ContributionForm';
import {getL2ValuesByCategory} from '@/components/FilterBar';
import Header from '@/components/Header';
import MapPlaceholder from '@/components/MapPlaceholder';
import ShopList from '@/components/ShopList';
import {mapShopList, mapSingleShop} from '@/lib/mappers/shop';
import {
  buildSearchResponse,
  expandQueryTerms,
  fallbackToSimilarCategories,
  logSearchQuery,
  matchExact,
  matchSynonymsWithWeights,
  normalizeQuery
} from '@/lib/search/tag-search';
import {supabase} from '@/lib/supabase';
import {useFavorites} from '@/lib/hooks/useFavorites';
import {DrawerFiltersState, Shop, ShopCategoryKey, ViewMode} from '@/types/shop';

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

const L1_KEYS: ShopCategoryKey[] = ['food', 'drink', 'vibe', 'region', 'deal', 'review'];

function hasDrawerFilters(filters: DrawerFiltersState): boolean {
  return filters.shopType !== '全部' || filters.ratingLabel !== null || filters.features.length > 0;
}


function filterByL1(tabKey: ShopCategoryKey, shops: Shop[]): Shop[] {
  if (tabKey === 'all' || tabKey === 'region') return shops;
  
  if (tabKey === 'review') {
    return shops.filter((s) => ['封神之作', '强烈推荐'].includes(s.ratingLabel));
  }

  if (tabKey === 'deal') {
    const dealTags = getL2ValuesByCategory('deal');
    return shops.filter(
      (s) =>
        s.category === 'deal' ||
        s.features.includes('有折扣') ||
        s.features.includes('学生价') ||
        s.tags.some((t) => dealTags.includes(t))
    );
  }

  if (tabKey === 'food' || tabKey === 'drink' || tabKey === 'vibe') {
    const groupTags = getL2ValuesByCategory(tabKey);
    return shops.filter((s) => s.category === tabKey || s.tags.some((t) => groupTags.includes(t)));
  }

  return shops.filter((s) => s.category === tabKey);
}

function filterByL2(tags: string[], shops: Shop[], l1Key: ShopCategoryKey): Shop[] {
  if (tags.length === 0) {
    return shops;
  }

  if (l1Key === 'region') {
    return shops.filter((s) => tags.includes(s.region ?? ''));
  }

  if (l1Key === 'vibe') {
    return shops.filter((s) => tags.some((tag) => s.tags.includes(tag)));
  }

  const selected = tags[0];
  return shops.filter((s) => s.tags.includes(selected));
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
  const [activeL2, setActiveL2] = useState<string[]>([]);
  const [drawerFilters, setDrawerFilters] = useState<DrawerFiltersState>(DEFAULT_DRAWER_FILTERS);
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
  const [showSubmissionFollowup, setShowSubmissionFollowup] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchFallbackMessage, setSearchFallbackMessage] = useState<string | null>(null);
  const [mobileSheetTopOffset, setMobileSheetTopOffset] = useState(116);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
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
    if (typeof window === 'undefined') {
      return;
    }

    const updateMobileSheetTopOffset = () => {
      const headerBottom = mobileHeaderRef.current?.getBoundingClientRect().bottom ?? 116;
      setMobileSheetTopOffset(Math.max(96, Math.round(headerBottom)));
    };

    updateMobileSheetTopOffset();
    window.addEventListener('resize', updateMobileSheetTopOffset);

    return () => {
      window.removeEventListener('resize', updateMobileSheetTopOffset);
    };
  }, []);

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

  const searchComputed = useMemo(() => {
    const keyword = normalizeQuery(searchQuery);

    if (!keyword) {
      return {
        searched: visibleShops,
        matchedLevel: 'exact' as const,
        fallbackMessage: null as string | null,
        matchedTags: [] as Array<{tag_id: string; tag_name: string; score_source: number}>
      };
    }

    const exact = matchExact(keyword, visibleShops);
    if (exact.length > 0) {
      return {
        searched: exact,
        matchedLevel: 'exact' as const,
        fallbackMessage: null as string | null,
        matchedTags: [] as Array<{tag_id: string; tag_name: string; score_source: number}>
      };
    }

    const synonymHits = matchSynonymsWithWeights(keyword);
    if (synonymHits.length > 0) {
      const bySynonym = visibleShops.filter((shop) =>
        synonymHits.some((hit) => shop.tags.includes(hit.tag_name) || shop.mainCategory === hit.tag_name)
      );

      if (bySynonym.length > 0) {
        return {
          searched: bySynonym,
          matchedLevel: 'synonym' as const,
          fallbackMessage: '已为你展示相近结果',
          matchedTags: synonymHits.map((hit) => ({tag_id: hit.tag_id, tag_name: hit.tag_name, score_source: hit.weight}))
        };
      }
    }

    const expandedTerms = expandQueryTerms(keyword);
    if (expandedTerms.length > 0) {
      const byExpanded = visibleShops.filter((shop) => {
        const pool = [shop.name, shop.address, shop.mainCategory ?? '', ...shop.tags, ...(shop.subTags ?? [])].join(' ').toLowerCase();
        return expandedTerms.some((term) => pool.includes(term.toLowerCase()));
      });

      if (byExpanded.length > 0) {
        return {
          searched: byExpanded,
          matchedLevel: 'expanded' as const,
          fallbackMessage: '已为你展示相近结果',
          matchedTags: [] as Array<{tag_id: string; tag_name: string; score_source: number}>
        };
      }
    }

    const similarCategories = fallbackToSimilarCategories(['中餐', '日料', '奶茶', '甜品']);
    const bySimilar = visibleShops.filter((shop) => similarCategories.some((tag) => shop.tags.includes(tag.tag_name)));

    return {
      searched: bySimilar.length > 0 ? bySimilar : visibleShops,
      matchedLevel: 'similar_category' as const,
      fallbackMessage: '已为你展示相近结果',
      matchedTags: similarCategories.map((tag) => ({tag_id: tag.tag_id, tag_name: tag.tag_name, score_source: 0.4}))
    };
  }, [searchQuery, visibleShops]);

  const displayedShops = useMemo(() => {
    const l1Filtered = filterByL1(activeL1, searchComputed.searched);
    const l2Filtered = filterByL2(activeL2, l1Filtered, activeL1);
    let drawerFiltered = applyDrawerFilters(l2Filtered, drawerFilters);

    if (showFavorites && isLoaded) {
      drawerFiltered = drawerFiltered.filter((shop) => favorites.includes(shop.id));
    }

    return drawerFiltered;
  }, [activeL1, activeL2, drawerFilters, searchComputed.searched, showFavorites, isLoaded, favorites]);

  useEffect(() => {
    setSearchFallbackMessage(searchComputed.fallbackMessage);

    const response = buildSearchResponse({
      query: searchQuery,
      matchedLevel: searchComputed.matchedLevel,
      items: searchComputed.searched,
      matchedTags: searchComputed.matchedTags,
      fallbackUsed: Boolean(searchComputed.fallbackMessage)
    });

    void logSearchQuery({
      query: response.query,
      hit: response.items.length > 0,
      matchedLevel: response.matched_level,
      resultCount: response.items.length,
      userAnonId: null,
      logger: async (payload) => {
        const {error} = await supabase.from('search_query_log').insert(payload);
        if (error) {
          console.error('search_query_log insert failed:', error.message);
        }
      }
    });
  }, [searchComputed.fallbackMessage, searchComputed.matchedLevel, searchComputed.matchedTags, searchComputed.searched, searchQuery]);

  const hasActiveTopFilters = activeL1 !== 'all' || activeL2.length > 0;
  const hasActiveDrawerFilters = hasDrawerFilters(drawerFilters);
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasActiveFavoriteFilter = showFavorites;
  const hasActiveFilters =
    hasActiveTopFilters ||
    hasActiveDrawerFilters ||
    hasActiveSearch ||
    hasActiveFavoriteFilter;

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (showFavorites) {
      labels.push(tFilters('myFavorites'));
    }

    if (activeL1 !== 'all') {
      labels.push(`${tHome('activeFilter.channelPrefix')}: ${tFilters(activeL1 === 'drink' ? 'drinksDesserts' : activeL1 === 'vibe' ? 'scenario' : activeL1 === 'region' ? 'area' : activeL1 === 'review' ? 'topPicks' : activeL1)}`);
    }

    if (activeL2.length > 0) {
      labels.push(...activeL2.map((l2) => `${tHome('activeFilter.l2Prefix')}: ${l2}`));
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

    return labels;
  }, [activeL1, activeL2, drawerFilters, hasActiveSearch, searchQuery, showFavorites, tFilters, tHome]);

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

  const handleL1Change = (l1: ShopCategoryKey) => {
    if (!L1_KEYS.includes(l1)) {
      return;
    }

    if (activeL1 === l1) {
      setActiveL1('all');
      setActiveL2([]);
      return;
    }

    setActiveL1(l1);
    setActiveL2([]);
  };

  const handleL2Change = (l1: ShopCategoryKey, l2: string) => {
    if (activeL1 !== l1) {
      return;
    }

    if (l1 === 'vibe' || l1 === 'region') {
      setActiveL2((prev) => (prev.includes(l2) ? prev.filter((item) => item !== l2) : [...prev, l2]));
    } else {
      setActiveL2((prev) => (prev[0] === l2 ? [] : [l2]));
    }
  };

  const resetAllFiltersAndSearch = () => {
    setActiveL1('all');
    setActiveL2([]);
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
          <div ref={mobileHeaderRef} className="pointer-events-auto rounded-b-[18px] bg-white px-[14px] pt-[max(env(safe-area-inset-top),4px)] pb-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
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

        </div>

        {pageError && (
          <p className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-sm text-rose-700 shadow-sm">
            {pageError}
          </p>
        )}
        {(pageNotice || searchFallbackMessage) && (
          <div className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 space-y-2">
            {pageNotice && (
              <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                {pageNotice}
              </p>
            )}
            {searchFallbackMessage && (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-700 shadow-sm">
                {searchFallbackMessage}
              </p>
            )}
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
          mobileTopOffsetPx={mobileSheetTopOffset}
          drawerFilters={drawerFilters}
          onChangeDrawerFilters={setDrawerFilters}
          activeL1={activeL1}
          activeL2={activeL2}
          onL1Change={handleL1Change}
          onL2Change={handleL2Change}
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



          {pageError && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-sm">{pageError}</p>
          )}
          {(pageNotice || searchFallbackMessage) && (
            <div className="mb-4 space-y-2">
              {pageNotice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">{pageNotice}</p>}
              {searchFallbackMessage && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 shadow-sm">{searchFallbackMessage}</p>}
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
                activeL1={activeL1}
                activeL2={activeL2}
                onL1Change={handleL1Change}
                onL2Change={handleL2Change}
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
