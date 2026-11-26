'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {useDiscoveryRefresh} from '@/lib/hooks/useDiscoveryRefresh';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Link} from '@/i18n/navigation';
import ContributionForm from '@/components/ContributionForm';
import {getL2ValuesByCategory} from '@/lib/search/filter-options';
import {selectSecondaryFilter} from '@/lib/search/filter-selection';
import Header from '@/components/Header';
import DiscoveryHighlights from '@/components/DiscoveryHighlights';
import {useNearbyBusinesses} from '@/lib/hooks/useNearbyBusinesses';
import {useStudentRecommendations} from '@/lib/hooks/useStudentRecommendations';
import {useAssistantPanel} from '@/components/assistant/GlobalAssistant';
import MapPlaceholder from '@/components/MapPlaceholder';
import MealDecision from '@/components/MealDecision';
import MobileCategoryNav from '@/components/MobileCategoryNav';
import NearbyPlaceSearch from '@/components/NearbyPlaceSearch';
import ShopList from '@/components/ShopList';
import {
  buildSearchResponse,
  normalizeQuery
} from '@/lib/search/tag-search';
import {normalizePlaceSearchRequest} from '@/lib/domain/search';
import {resolveSearchTagAlias} from '@/lib/domain/taxonomy';
import {isLaunchCategory, matchesLaunchCategory} from '@/lib/domain/place-types';
import {createRequestGuard} from '@/lib/data/async-request';
import {filterBySelectedFacet} from '@/lib/search/legacy-filters';
import {filterFoodPlaces} from '@/lib/search/food-filters';
import {filterRecommendedPlaces} from '@/lib/search/recommendation-filters';
import {parseDiscoveryUrlState, updateDiscoverySearchParams} from '@/lib/search/url-state';
import {rankCompatibilityPlaces} from '@/lib/services/search-places';
import {amapDiningTypeForFilters, rankNearbyDining, type AmapPoiOption, type AmapPoiSearchOrigin} from '@/lib/amap/place-search';
import {deriveRatingLabelFromScore} from '@/lib/shops/normalization';
import {supabase} from '@/lib/supabase';
import {useSharedFavorites} from '@/lib/favorites/FavoritesProvider';
import {shouldTrackVisit} from '@/lib/analytics/traffic-policy';
import {DrawerFiltersState, Shop, ShopCategoryKey, ViewMode} from '@/types/shop';

const DEFAULT_DRAWER_FILTERS: DrawerFiltersState = {
  shopType: '全部',
  ratingLabel: null,
  features: []
};

const nearbySearchEnabled = process.env.NEXT_PUBLIC_NEARBY_SEARCH_ENABLED === 'true' &&
  Boolean(process.env.NEXT_PUBLIC_AMAP_WEB_KEY);

const L1_KEYS: ShopCategoryKey[] = [
  'all',
  'hair-salon',
  'bar',
  'tabletop',
  'food',
  'drink',
  'shopping',
  'entertainment',
  'service',
  'vibe',
  'region',
  'deal',
  'review'
];

function hasDrawerFilters(filters: DrawerFiltersState): boolean {
  return filters.shopType !== '全部' || filters.ratingLabel !== null || filters.features.length > 0;
}


function filterByL1(tabKey: ShopCategoryKey, shops: Shop[]): Shop[] {
  if (tabKey === 'all' || tabKey === 'region' || tabKey === 'review') return shops;
  if (isLaunchCategory(tabKey)) return shops.filter(shop => matchesLaunchCategory(shop, tabKey));
  
  if (tabKey === 'deal') {
    const dealTags = getL2ValuesByCategory('deal');
    const tagMatches = new Set(filterBySelectedFacet(dealTags, shops, 'deal').map((shop) => shop.id));
    return shops.filter(
      (s) =>
        s.category === 'deal' ||
        s.features.includes('有折扣') ||
        s.features.includes('学生价') ||
        tagMatches.has(s.id)
    );
  }

  if (tabKey === 'drink' || tabKey === 'vibe') {
    const groupTags = getL2ValuesByCategory(tabKey);
    const tagMatches = new Set(filterBySelectedFacet(groupTags, shops, tabKey).map((shop) => shop.id));
    return shops.filter((s) => s.category === tabKey || tagMatches.has(s.id));
  }

  return shops.filter((s) => s.category === tabKey);
}

function filterByL2(tags: string[], shops: Shop[], l1Key: ShopCategoryKey): Shop[] {
  if (l1Key === 'review') {
    return filterRecommendedPlaces(tags, shops);
  }
  if (l1Key === 'food') return filterFoodPlaces(tags, shops);
  return filterBySelectedFacet(tags, shops, l1Key);
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

export default function DiscoveryPage({active = true}: {active?: boolean}) {
  const t = useTranslations('Common');
  const tContribute = useTranslations('Contribute');
  const tHome = useTranslations('Home');
  const tNearby = useTranslations('NearbyDiscovery');
  const tMealDecision = useTranslations('MealDecision');
  const tDiscovery = useTranslations('LiveDiscovery');
  const locale = useLocale() as 'zh-CN' | 'zh-MO' | 'en';

  const [, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [activeL1, setActiveL1] = useState<ShopCategoryKey>('all');
  const [activeL2, setActiveL2] = useState<string[]>([]);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<DrawerFiltersState>(DEFAULT_DRAWER_FILTERS);
  const [showFavorites, setShowFavorites] = useState(false);
  const {favorites, toggleFavorite, isLoaded} = useSharedFavorites();
  const [selectedShopId, setSelectedShopId] = useState<Shop['id'] | null>(null);
  const [collapseMobileSheetSignal, setCollapseMobileSheetSignal] = useState(0);
  const [locateSignal, setLocateSignal] = useState(0);
  const {toggle: toggleAssistant} = useAssistantPanel();
  const [poiUserCoordinates, setPoiUserCoordinates] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(14);
  const desktopMapCenter = useRef<[number, number] | null>(null);
  const mobileMapCenter = useRef<[number, number] | null>(null);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyHighlightsOpen, setNearbyHighlightsOpen] = useState(false);
  const [showStudentPicks, setShowStudentPicks] = useState(false);
  const studentRecommendations = useStudentRecommendations(active && showStudentPicks);
  const [highlightedBusiness, setHighlightedBusiness] = useState<AmapPoiOption | null>(null);
  const [mealDecisionOpen, setMealDecisionOpen] = useState(false);
  const [nearbyCenter, setNearbyCenter] = useState<[number, number] | null>(null);
  const [nearbyPin, setNearbyPin] = useState<{longitude: number; latitude: number} | null>(null);
  const updateMobileMapCenter = useCallback((center: [number, number], zoom: number) => {
    mobileMapCenter.current = center;
    if (!window.matchMedia('(min-width: 768px)').matches) {
      setMapCenter(center);
      setMapZoom(zoom);
    }
  }, []);
  const updateDesktopMapCenter = useCallback((center: [number, number], zoom: number) => {
    desktopMapCenter.current = center;
    if (window.matchMedia('(min-width: 768px)').matches) {
      setMapCenter(center);
      setMapZoom(zoom);
    }
  }, []);
  const browsingDining = activeL1 === 'all' || activeL1 === 'food';
  const diningType = amapDiningTypeForFilters(activeL2);
  const diningMode = nearbySearchEnabled && browsingDining && diningType !== null &&
    !showFavorites && drawerFilters.shopType === '全部' && drawerFilters.features.length === 0;
  const businesses = useNearbyBusinesses(active && urlStateReady && diningMode, mapCenter, mapZoom,
    tNearby('unnamed'), debouncedSearchQuery.trim(), diningType ?? undefined);
  const rankedRestaurants = useMemo(() => {
    const coordinates = poiUserCoordinates ?? mapCenter;
    const ranked = coordinates ? rankNearbyDining(businesses.items, {
      coordinates, source: poiUserCoordinates ? 'user' : 'map'
    }) : businesses.items;
    return drawerFilters.ratingLabel ? ranked.filter(place =>
      place.rating !== undefined && deriveRatingLabelFromScore(place.rating) === drawerFilters.ratingLabel
    ) : ranked;
  }, [businesses.items, mapCenter, poiUserCoordinates, drawerFilters.ratingLabel]);
  const liveRestaurants = diningMode ? {...businesses, items: rankedRestaurants} : undefined;
  const selectBusiness = useCallback((place: AmapPoiOption) => {
    setHighlightedBusiness(place);
    setNearbyHighlightsOpen(true);
  }, []);
  const selectMapShop = useCallback((id: Shop['id']) => {
    setNearbyPin(null);
    setSelectedShopId(id);
  }, []);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);


  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const contributionBusyRef = useRef(false);
  const handleContributionBusyChange = useCallback((busy: boolean) => {
    contributionBusyRef.current = busy;
  }, []);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [manualCoordinates, setManualCoordinates] = useState<[number, number] | null>(null);

  const [showSubmissionFollowup, setShowSubmissionFollowup] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [searchFallbackMessage, setSearchFallbackMessage] = useState<string | null>(null);
  const [mobileSheetTopOffset, setMobileSheetTopOffset] = useState(116);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const shopsRequestGuardRef = useRef(createRequestGuard());
  const shopRequestsPendingRef = useRef(0);
  const poiSearchOrigin = useMemo<AmapPoiSearchOrigin | null>(() => {
    if (poiUserCoordinates) return {coordinates: poiUserCoordinates, source: 'user'};
    if (mapCenter) return {coordinates: mapCenter, source: 'map'};
    return null;
  }, [mapCenter, poiUserCoordinates]);
  const roleRequestGuardRef = useRef(createRequestGuard());
  const hasFetchedRef = useRef(false);
  const lastLoggedQueryRef = useRef<{query: string; at: number} | null>(null);

  useEffect(() => {
    const applyUrlState = () => {
      const state = parseDiscoveryUrlState(window.location.search);
      setSearchQuery(state.query);
      setActiveL1(state.category);
      setActiveL2(state.tags);
      setUrlStateReady(true);
    };

    applyUrlState();
    const restoreFromHistory = () => {
      if (window.location.pathname.replace(/\/$/, '') === `/${locale}`) applyUrlState();
    };
    window.addEventListener('popstate', restoreFromHistory);
    return () => window.removeEventListener('popstate', restoreFromHistory);
  }, [locale]);

  useEffect(() => {
    if (!active || !urlStateReady || window.location.pathname.replace(/\/$/, '') !== `/${locale}`) return;
    const params = updateDiscoverySearchParams(new URLSearchParams(window.location.search), {
      query: searchQuery,
      category: activeL1,
      tags: activeL2
    });
    const next = `${window.location.pathname}${params.size > 0 ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', next);
  }, [active, activeL1, activeL2, locale, searchQuery, urlStateReady]);

  const fetchShops = useCallback(async (options?: {silent?: boolean}) => {
    const silent = options?.silent ?? false;
    // Automatic work must not supersede a pending initial/manual/role-change refresh.
    if (silent && shopRequestsPendingRef.current > 0) return;
    shopRequestsPendingRef.current += 1;
    const requestToken = shopsRequestGuardRef.current.begin();
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/places', {cache: 'no-store'});
      const body = await response.json().catch(() => null) as {
        ok?: boolean; data?: {items?: Shop[]; canonicalAvailable?: boolean}
      } | null;
      if (!response.ok || body?.ok !== true || body.data?.canonicalAvailable === false || !Array.isArray(body.data?.items)) {
        throw new Error('Published places are unavailable');
      }
      if (!shopsRequestGuardRef.current.isCurrent(requestToken)) return;
      setShops(body.data.items);
      setPageError(null);

      if (hasFetchedRef.current && !silent) {
        toast.success(tHome('toast.updated'));
      }

      hasFetchedRef.current = true;
    } catch (error) {
      if (!shopsRequestGuardRef.current.isCurrent(requestToken)) {
        return;
      }
      console.error('Failed to fetch shops:', error);
      if (!silent) {
        setShops([]);
        setPageError(tHome('toast.loadFailed'));
        toast.error(tHome('toast.loadFailed'));
      }
    } finally {
      shopRequestsPendingRef.current -= 1;
      if (shopsRequestGuardRef.current.isCurrent(requestToken)) {
        setLoading(false);
      }
    }
  }, [tHome]);

  const fetchCurrentUser = useCallback(async () => {
    const requestToken = roleRequestGuardRef.current.begin();
    const {data: authData, error: authError} = await supabase.auth.getUser();

    if (!roleRequestGuardRef.current.isCurrent(requestToken)) {
      return;
    }

    if (authError || !authData?.user) {
      setUserEmail(null);
      return;
    }

    const user = authData.user;
    setUserEmail(user.email ?? null);

  }, []);

  useEffect(() => {
    // Guard objects are stable across renders; capture them so the cleanup
    // closes over the same instances instead of re-reading the ref.
    const roleGuard = roleRequestGuardRef.current;
    fetchCurrentUser();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((_event, session) => {
      roleGuard.invalidate();
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
      roleGuard.invalidate();
    };
  }, [fetchCurrentUser]);

  useEffect(() => {
    const shopsGuard = shopsRequestGuardRef.current;
    fetchShops();

    return () => {
      shopsGuard.invalidate();
    };
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
    const observer = new ResizeObserver(updateMobileSheetTopOffset);
    if (mobileHeaderRef.current) observer.observe(mobileHeaderRef.current);
    window.addEventListener('resize', updateMobileSheetTopOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateMobileSheetTopOffset);
    };
  }, []);

  const quietlyRefreshShops = useCallback(async () => {
    if (active) await fetchShops({silent: true});
  }, [active, fetchShops]);
  useDiscoveryRefresh(quietlyRefreshShops);

  const visibleShops = useMemo(() => shops.filter(shop => shop.status === 'verified'), [shops]);

  const searchComputed = useMemo(() => {
    const request = normalizePlaceSearchRequest({query: debouncedSearchQuery});

    if (!request.query) {
      return {
        searched: visibleShops,
        matchedLevel: 'exact' as const,
        fallbackMessage: null as string | null,
        matchedTags: [] as Array<{tag_id: string; tag_name: string; score_source: number}>
      };
    }

    const ranked = rankCompatibilityPlaces(request, visibleShops);
    const matchedTags = resolveSearchTagAlias(request.query).map((tag) => ({
      tag_id: tag.id,
      tag_name: tag.labelZhMO,
      score_source: 1
    }));

    return {
      searched: ranked.map((hit) => hit.item),
      matchedLevel: ranked.some((hit) => hit.matchedBy.includes('tag_alias'))
        ? ('synonym' as const)
        : ('exact' as const),
      fallbackMessage: null as string | null,
      matchedTags
    };
  }, [debouncedSearchQuery, visibleShops]);

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
      query: debouncedSearchQuery,
      matchedLevel: searchComputed.matchedLevel,
      items: searchComputed.searched,
      matchedTags: searchComputed.matchedTags,
      fallbackUsed: Boolean(searchComputed.fallbackMessage)
    });

    const normalized = normalizeQuery(response.query);
    if (!shouldTrackVisit(window.location.hostname, window.location.pathname, process.env.NODE_ENV)) return;
    if (normalized.length < 2) {
      return;
    }

    const now = Date.now();
    const lastLogged = lastLoggedQueryRef.current;
    if (lastLogged && lastLogged.query === normalized && now - lastLogged.at < 10_000) {
      return;
    }

    lastLoggedQueryRef.current = {query: normalized, at: now};

    void fetch('/api/search/events', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      keepalive: true,
      body: JSON.stringify({
        query: response.query.slice(0, 200),
        normalized_query: normalized.slice(0, 200),
        filters: {category: activeL1, tags: activeL2, drawer: drawerFilters},
        result_count: response.items.length,
        matched_level:
          response.items.length === 0
            ? 'none'
            : response.matched_level === 'synonym'
              ? 'alias'
              : 'name'
      })
    }).catch(() => {
      // Search analytics must never interrupt the discovery experience.
    });
  }, [activeL1, activeL2, debouncedSearchQuery, drawerFilters, searchComputed.fallbackMessage, searchComputed.matchedLevel, searchComputed.matchedTags, searchComputed.searched]);

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

    if (drawerFilters.shopType !== '全部') {
      labels.push(drawerFilters.shopType);
    }

    if (drawerFilters.ratingLabel) {
      labels.push(drawerFilters.ratingLabel);
    }

    if (drawerFilters.features.length > 0) {
      labels.push(...drawerFilters.features.filter(feature => !['外卖可达', '深夜营业'].includes(feature)));
    }

    if (hasActiveSearch) {
      labels.push(`${tHome('activeFilter.searchPrefix')}: ${searchQuery.trim()}`);
    }

    return labels;
  }, [drawerFilters, hasActiveSearch, searchQuery, tHome]);

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

  const handleL2Change = (l1: ShopCategoryKey, l2: string | null) => {
    if (activeL1 !== l1) {
      return;
    }

    setActiveL2(prev => selectSecondaryFilter(l1, prev, l2));
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

    selectMapShop(shopId);
    setViewMode('map');
    setCollapseMobileSheetSignal((prev) => prev + 1);
    setLocateSignal((prev) => prev + 1);
    return true;
  };

  const openNearbySearch = () => {
    setNearbyCenter(window.matchMedia('(min-width: 768px)').matches
      ? desktopMapCenter.current : mobileMapCenter.current);
    setNearbyOpen(true);
  };

  const locateNearbyPlace = ({coordinates: [longitude, latitude]}: AmapPoiOption) => {
    setNearbyPin({longitude, latitude});
    setSelectedShopId(null);
    setCollapseMobileSheetSignal((previous) => previous + 1);
    setNearbyOpen(false);
    setNearbyHighlightsOpen(false);
  };

  const discoveryActionClass = 'min-h-10 rounded-xl border border-emerald-200 bg-white px-2.5 text-sm font-medium text-emerald-800 shadow-sm hover:bg-emerald-50';
  const discoveryActions = !mapPickMode && <>
    {nearbySearchEnabled && <button type="button" data-discovery-action="nearby" aria-haspopup="dialog" aria-controls="nearby-place-search"
      className={discoveryActionClass} onClick={openNearbySearch}>{tDiscovery('manualMapSearch')}</button>}
    <button type="button" aria-haspopup="dialog" aria-controls="meal-decision" onClick={() => setMealDecisionOpen(true)}
      className="min-h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-800 shadow-sm hover:bg-emerald-50">
      {tMealDecision('title')}
    </button>
  </>;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
  };

  return (
    <div className="min-h-[calc(100dvh-var(--main-nav-bottom)-var(--main-nav-top))] text-slate-800 md:bg-slate-50">
      <div className="relative md:hidden">
        <div className="fixed inset-x-0 top-0 bottom-[var(--main-nav-bottom)] z-0 m-0 w-full p-0">
          <MapPlaceholder
            shops={displayedShops}
            activeL1={activeL1}
            selectedShopId={selectedShopId}
            locateSignal={locateSignal}
            onSelectShop={selectMapShop}
            highlightedLocation={mapPickMode ? null : nearbyPin}
            contributionPickMode={mapPickMode}
            onPickCoordinates={(coords) => {
              setManualCoordinates(coords);
              setMapPickMode(false);
            }}
            onViewportCenterChange={updateMobileMapCenter}
            onUserLocationChange={setPoiUserCoordinates}
            externalPlaces={liveRestaurants?.items}
            onSelectExternalPlace={selectBusiness}
            mobileControlsTop={mobileSheetTopOffset + 8}
          />
        </div>

        <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col">
          <div ref={mobileHeaderRef} className="pointer-events-auto px-4 pt-[max(env(safe-area-inset-top),16px)]">
            <Header
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchPlaceholder={t('searchPlaceholder')}
              userEmail={userEmail}
              loginHref="/login"
              mySubmissionsHref="/my-submissions"
              onLogout={handleLogout}
              onToggleContribute={() => {
                if (contributionBusyRef.current) return;
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
            <MobileCategoryNav active={activeL1} onChange={handleL1Change} />
            {discoveryActions && <div className="mt-2 flex flex-wrap gap-2">{discoveryActions}</div>}
          </div>

        </div>

        {pageError && (
          <p className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-sm text-rose-700 shadow-sm">
            {pageError}
          </p>
        )}
        {(pageNotice || (!showStudentPicks && searchFallbackMessage)) && (
          <div className="pointer-events-none absolute left-[14px] right-[14px] top-[168px] z-40 space-y-2">
            {pageNotice && (
              <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                {pageNotice}
              </p>
            )}
            {!showStudentPicks && searchFallbackMessage && (
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
          layout="mobile"
          filteredShops={displayedShops}
          publishedShops={visibleShops}
          liveRestaurants={liveRestaurants}
          showCatalogSource={browsingDining}
          showStudentPicks={showStudentPicks}
          setShowStudentPicks={setShowStudentPicks}
          studentRecommendations={studentRecommendations}
          onLocateRestaurant={locateNearbyPlace}
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
          collapseMobileSheetSignal={collapseMobileSheetSignal}
          mobileTopOffsetPx={mobileSheetTopOffset}
          onToggleAssistant={toggleAssistant}
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
            if (contributionBusyRef.current) return;
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

        <main className="relative mx-auto max-w-[1380px] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:px-6 md:pb-4 lg:px-8">
          {isContributeOpen && (
            <div style={{display: mapPickMode ? 'none' : undefined}} className="mt-2 max-h-[60dvh] overflow-y-auto">
              <ContributionForm
                onBusyChange={handleContributionBusyChange}
                manualCoordinates={manualCoordinates}
                poiSearchOrigin={poiSearchOrigin}
                onRequestMapPick={() => {
                  setManualCoordinates(null);
                  setCollapseMobileSheetSignal(value => value + 1);
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
          {(pageNotice || (!showStudentPicks && searchFallbackMessage)) && (
            <div className="mb-4 space-y-2">
              {pageNotice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">{pageNotice}</p>}
              {!showStudentPicks && searchFallbackMessage && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 shadow-sm">{searchFallbackMessage}</p>}
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

          <div className="mt-3 grid grid-cols-1 gap-0 md:h-[calc(100dvh-12.5rem-var(--main-nav-top))] md:grid-cols-12 md:gap-4 lg:gap-5">
            <div className="order-1 h-[58dvh] min-h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:order-2 md:col-span-8 md:h-full lg:col-span-8">
              <MapPlaceholder
                shops={displayedShops}
                activeL1={activeL1}
                selectedShopId={selectedShopId}
                locateSignal={locateSignal}
                onSelectShop={selectMapShop}
                highlightedLocation={mapPickMode ? null : nearbyPin}
                contributionPickMode={mapPickMode}
                onPickCoordinates={(coords) => {
                  setManualCoordinates(coords);
                  setMapPickMode(false);
                }}
                onViewportCenterChange={updateDesktopMapCenter}
                onUserLocationChange={setPoiUserCoordinates}
                externalPlaces={liveRestaurants?.items}
                onSelectExternalPlace={selectBusiness}
              />
            </div>

            <div className="order-2 flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:order-1 md:col-span-4 md:p-3.5 lg:col-span-4">
              {discoveryActions && <div className="mb-2 flex flex-wrap gap-2">{discoveryActions}</div>}
              <div className="min-h-0 flex-1">
                <ShopList
                  layout="desktop"
                  filteredShops={displayedShops}
                  publishedShops={visibleShops}
                  liveRestaurants={liveRestaurants}
                  showCatalogSource={browsingDining}
                  showStudentPicks={showStudentPicks}
                  setShowStudentPicks={setShowStudentPicks}
                  studentRecommendations={studentRecommendations}
                  onLocateRestaurant={locateNearbyPlace}
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
          </div>
        </main>
      </div>

      {isContributeOpen && (
        <div style={{display: mapPickMode ? 'none' : undefined}} className="fixed inset-x-0 bottom-[var(--main-nav-bottom)] z-[90] max-h-[calc(90dvh-var(--main-nav-bottom))] overflow-y-auto px-3 pb-3 md:hidden">
          <ContributionForm
            onBusyChange={handleContributionBusyChange}
            manualCoordinates={manualCoordinates}
            poiSearchOrigin={poiSearchOrigin}
            onRequestMapPick={() => {
              setManualCoordinates(null);
              setCollapseMobileSheetSignal(value => value + 1);
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
      {isContributeOpen && mapPickMode && <div className="fixed inset-x-3 bottom-[calc(var(--main-nav-bottom)+1rem)] z-[95] mx-auto max-w-md rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-lg">
        <p className="font-medium text-emerald-900">请在地图上点击地点的实际位置</p>
        <p className="mt-1 text-xs text-slate-600">不知道具体位置，可以返回填写并搜索附近地标。</p>
        <button type="button" onClick={() => setMapPickMode(false)} className="mt-2 min-h-10 rounded-lg border border-slate-300 px-3 text-emerald-800">返回填写／搜索地标</button>
      </div>}
      {nearbySearchEnabled && (
        <NearbyPlaceSearch open={active && nearbyOpen} mapCenter={nearbyCenter} userCoordinates={poiUserCoordinates}
          onClose={() => setNearbyOpen(false)} onLocate={locateNearbyPlace} />
      )}
      <DiscoveryHighlights open={active && nearbyHighlightsOpen} nearby={businesses} selected={highlightedBusiness}
        onClose={() => setNearbyHighlightsOpen(false)} onLocate={locateNearbyPlace}
        onManualSearch={() => {setNearbyHighlightsOpen(false); openNearbySearch();}} />
      <MealDecision open={active && mealDecisionOpen} matchingPlaces={displayedShops}
        catalogLoading={loading || searchQuery.trim() !== debouncedSearchQuery.trim()}
        onClose={() => setMealDecisionOpen(false)} />
    </div>
  );
}
