'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import ContributionForm from '@/components/ContributionForm';
import Header from '@/components/Header';
import MapPlaceholder from '@/components/MapPlaceholder';
import ShopList from '@/components/ShopList';
import {FILTERS} from '@/data/shops';
import {mapShopList} from '@/lib/mappers/shop';
import {supabase} from '@/lib/supabase';
import {FilterOption, Shop, ViewMode} from '@/types/shop';

export default function Page() {
  const t = useTranslations('Common');
  const tFilters = useTranslations('Filters');
  const tContribute = useTranslations('Contribute');
  const tShopCard = useTranslations('ShopCard');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('全部');
  const [selectedShopId, setSelectedShopId] = useState<Shop['id'] | null>(null);
  const [hoveredShopId, setHoveredShopId] = useState<Shop['id'] | null>(null);
  const [collapseMobileSheetSignal, setCollapseMobileSheetSignal] = useState(0);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [approvingShopId, setApprovingShopId] = useState<Shop['id'] | null>(null);
  const [deletingShopId, setDeletingShopId] = useState<Shop['id'] | null>(null);

  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [manualCoordinates, setManualCoordinates] = useState<[number, number] | null>(null);

  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);

    try {
      const {data, error} = await supabase
        .from('shops')
        .select('id,name,category,student_discount,tags,latitude,longitude,status,rating,total_sum,rating_count,review_text,image_urls,address')
        .in('status', ['verified', 'pending']);

      if (error) {
        console.error('Failed to fetch shops:', error.message);
        setShops([]);
        return;
      }

      setShops(mapShopList((data ?? []) as unknown[]));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUserRole = useCallback(async () => {
    const {data: authData, error: authError} = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setIsAuthenticated(false);
      setUserRole(null);
      setUserEmail(null);
      return;
    }

    setIsAuthenticated(true);
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
    fetchShops();
    fetchCurrentUserRole();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange(() => {
      fetchCurrentUserRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchShops, fetchCurrentUserRole]);

  const isAdmin = userRole === 'admin';
  const mapVisibleShops = isAdmin ? shops : shops.filter((shop) => shop.status === 'verified');

  const filteredShops = shops.filter((shop) => {
    if (!isAdmin && shop.status !== 'verified') {
      return false;
    }

    const keyword = searchQuery.trim().toLowerCase();
    const searchableValues = [shop.name, ...shop.tags];

    const matchesSearch =
      keyword.length === 0 ||
      searchableValues.some((value) => value.toLowerCase().includes(keyword));

    if (!matchesSearch) {
      return false;
    }

    switch (activeFilter) {
      case '餐饮':
        return shop.type === '餐饮';
      case '服务':
        return shop.type === '服务';
      case '有折扣':
        return shop.studentDiscount !== null;
      case '强推':
        return shop.recommendStatus === 'recommend';
      default:
        return true;
    }
  });

  useEffect(() => {
    if (filteredShops.length === 0) {
      setSelectedShopId(null);
      return;
    }

    const stillExists = filteredShops.some((shop) => shop.id === selectedShopId);
    if (!stillExists) {
      setSelectedShopId(null);
    }
  }, [filteredShops, selectedShopId]);

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

  const filterLabelMap = useMemo<Record<FilterOption, string>>(
    () => ({
      全部: tFilters('all'),
      餐饮: tFilters('food'),
      服务: tFilters('service'),
      有折扣: tFilters('discount'),
      强推: tFilters('recommend')
    }),
    [tFilters]
  );

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800">
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        title={t('title')}
        searchPlaceholder={t('searchPlaceholder')}
        isAdmin={isAdmin}
        userEmail={userEmail}
        loginHref="/admin-login"
        onLogout={handleLogout}
      />

      <main className="mx-auto h-[calc(100dvh-4rem)] max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t('welcome')}</p>
          <button
            type="button"
            onClick={() => {
              setIsContributeOpen((prev) => !prev);
              setMapPickMode(false);
              setManualCoordinates(null);
              setPageError(null);
              setPageNotice(null);
            }}
            className="inline-flex items-center rounded-xl border border-[#CCAA00] bg-[#FFCC00] px-3 py-2 text-sm font-semibold text-[#124d2f] transition hover:brightness-95"
          >
            {tContribute('button')}
          </button>
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

        <div className="grid h-[calc(100dvh-14.5rem)] grid-cols-1 gap-5 md:h-[calc(100dvh-11rem)] md:grid-cols-12 md:gap-6">
          <div className="order-1 h-[42dvh] min-h-[260px] md:order-2 md:col-span-8 md:h-full lg:col-span-8">
            <MapPlaceholder
              shops={mapVisibleShops}
              viewMode={viewMode}
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
              filters={FILTERS}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              filteredShops={filteredShops}
              loading={loading}
              viewMode={viewMode}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onLocateShop={handleLocateShop}
              onHoverShop={setHoveredShopId}
              mobileSearchPlaceholder={t('mobileSearchPlaceholder')}
              emptyText={t('emptyResult')}
              filterLabelMap={filterLabelMap}
              canApprove={isAdmin}
              approvingShopId={approvingShopId}
              onApproveShop={handleApproveShop}
              canDelete={isAdmin}
              deletingShopId={deletingShopId}
              onDeleteShop={handleDeleteShop}
              collapseMobileSheetSignal={collapseMobileSheetSignal}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
