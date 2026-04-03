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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
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

        {pageError && <p className="mb-4 text-sm text-rose-600">{pageError}</p>}
        {pageNotice && <p className="mb-4 text-sm text-emerald-600">{pageNotice}</p>}

        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-10rem)]">
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
            mobileSearchPlaceholder={t('mobileSearchPlaceholder')}
            emptyText={t('emptyResult')}
            filterLabelMap={filterLabelMap}
            canApprove={isAdmin}
            approvingShopId={approvingShopId}
            onApproveShop={handleApproveShop}
            canDelete={isAuthenticated}
            deletingShopId={deletingShopId}
            onDeleteShop={handleDeleteShop}
          />

          <MapPlaceholder
            shops={mapVisibleShops}
            viewMode={viewMode}
            selectedShopId={selectedShopId}
            onSelectShop={setSelectedShopId}
            contributionPickMode={mapPickMode}
            onPickCoordinates={(coords) => {
              setManualCoordinates(coords);
              setMapPickMode(false);
            }}
          />
        </div>
      </main>
    </div>
  );
}
