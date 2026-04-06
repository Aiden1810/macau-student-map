'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import ImageUpload from '@/components/ImageUpload';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {supabase} from '@/lib/supabase';
import {ShopFeature} from '@/types/shop';

type GeocodeOption = {
  placeId: string;
  name: string;
  fullAddress: string;
  coordinates: [number, number];
};

interface ContributionFormProps {
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
  onRequestMapPick: () => void;
  manualCoordinates: [number, number] | null;
}

type RatingOption = {
  label: '封神之作' | '强烈推荐' | '还行吧' | '建议避雷';
  value: number;
};

const RATING_OPTIONS: RatingOption[] = [
  {label: '封神之作', value: 5.0},
  {label: '强烈推荐', value: 4.0},
  {label: '还行吧', value: 3.0},
  {label: '建议避雷', value: 1.0}
];

const SHOP_TYPE_OPTIONS = ['正餐', '快餐小吃', '饮品甜点', '服务'] as const;
const FEATURE_OPTIONS: ShopFeature[] = ['有折扣', '学生价', '深夜营业', '适合拍照', '外卖可达'];

type AMapPlaceSearchPoi = {
  id?: string;
  name?: string;
  address?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  location?: {
    lng?: number;
    lat?: number;
  };
};

type AMapPlaceSearchResult = {
  info?: string;
  poiList?: {
    pois?: AMapPlaceSearchPoi[];
  };
};

type AMapPlaceSearchInstance = {
  search: (keyword: string, callback: (status: string, result: AMapPlaceSearchResult) => void) => void;
};

type AMapNamespace = {
  plugin: (name: string, callback: () => void) => void;
  PlaceSearch: new (options: {
    city: string;
    citylimit: boolean;
    pageSize: number;
    pageIndex: number;
    extensions: 'base' | 'all';
  }) => AMapPlaceSearchInstance;
};

type AMapWindow = Window & {
  AMap?: AMapNamespace;
  __amapPlaceLoadingPromise?: Promise<AMapNamespace>;
  _AMapSecurityConfig?: {securityJsCode?: string};
};

function loadAmapPlaceSdk(key: string): Promise<AMapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap only works in browser'));
  }

  const w = window as AMapWindow;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  if (securityCode && !w._AMapSecurityConfig) {
    w._AMapSecurityConfig = {securityJsCode: securityCode};
  }

  if (w.AMap) {
    return Promise.resolve(w.AMap);
  }

  if (w.__amapPlaceLoadingPromise) {
    return w.__amapPlaceLoadingPromise;
  }

  w.__amapPlaceLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-amap="true"]');

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (w.AMap) resolve(w.AMap);
      });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load AMap script')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.PlaceSearch`;
    script.async = true;
    script.defer = true;
    script.dataset.amap = 'true';

    script.onload = () => {
      if (w.AMap) {
        resolve(w.AMap);
      } else {
        reject(new Error('AMap script loaded but AMap is unavailable'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load AMap script'));

    document.head.appendChild(script);
  });

  return w.__amapPlaceLoadingPromise;
}

export default function ContributionForm({
  onSuccess,
  onCancel,
  onRequestMapPick,
  manualCoordinates
}: ContributionFormProps) {
  const tContribute = useTranslations('Contribute');

  const [geocodeQuery, setGeocodeQuery] = useState('');
  const debouncedGeocodeQuery = useDebounce(geocodeQuery, 300);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeOption[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GeocodeOption | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const [manualMode, setManualMode] = useState(false);
  const [manualShopName, setManualShopName] = useState('');

  const [category, setCategory] = useState<'food' | 'drink' | 'vibe' | 'deal' | ''>('');
  const [shopType, setShopType] = useState<(typeof SHOP_TYPE_OPTIONS)[number] | ''>('');
  const [selectedRatingLabel, setSelectedRatingLabel] = useState<RatingOption['label']>('强烈推荐');
  const [selectedFeatures, setSelectedFeatures] = useState<ShopFeature[]>([]);

  const [reviewText, setReviewText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [contributeMessage, setContributeMessage] = useState<string | null>(null);
  const [contributeError, setContributeError] = useState<string | null>(null);

  const selectedRating = useMemo(
    () => RATING_OPTIONS.find((item) => item.label === selectedRatingLabel) ?? RATING_OPTIONS[1],
    [selectedRatingLabel]
  );

  useEffect(() => {
    let cancelled = false;

    const runGeocode = async () => {
      const amapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY;
      const keyword = debouncedGeocodeQuery.trim();

      if (!amapKey || keyword.length < 2 || manualMode) {
        setGeocodeResults([]);
        return;
      }

      setGeocodeLoading(true);
      setContributeError(null);

      try {
        const AMap = await loadAmapPlaceSdk(amapKey);

        const searchWithPlaceSearch = (city: string, searchKeyword: string): Promise<GeocodeOption[]> =>
          new Promise((resolve, reject) => {
            AMap.plugin('AMap.PlaceSearch', () => {
              const placeSearch = new AMap.PlaceSearch({
                city,
                citylimit: true,
                pageSize: 8,
                pageIndex: 1,
                extensions: 'base'
              });

              placeSearch.search(searchKeyword, (status: string, result: AMapPlaceSearchResult) => {
                if (status !== 'complete' || !result?.poiList?.pois) {
                  if (result?.info && result.info !== 'OK') {
                    reject(new Error(result.info));
                    return;
                  }
                  resolve([]);
                  return;
                }

                const options = result.poiList.pois
                  .map((poi) => {
                    const lng = Number(poi?.location?.lng);
                    const lat = Number(poi?.location?.lat);

                    if (!poi?.id || Number.isNaN(lng) || Number.isNaN(lat)) {
                      return null;
                    }

                    const region = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(' ');
                    const address = [region, poi.address].filter(Boolean).join(' ');

                    return {
                      placeId: String(poi.id),
                      name: String(poi.name || '').trim() || tContribute('unnamedPlace'),
                      fullAddress: address.trim(),
                      coordinates: [lng, lat] as [number, number]
                    };
                  })
                  .filter((item): item is GeocodeOption => item !== null);

                resolve(options);
              });
            });
          });

        const [macauOptions, zhuhaiOptions] = await Promise.all([
          searchWithPlaceSearch('澳门', keyword),
          searchWithPlaceSearch('珠海', keyword)
        ]);

        let options = [...macauOptions, ...zhuhaiOptions].filter(
          (item, index, arr) => arr.findIndex((x) => x.placeId === item.placeId) === index
        );

        if (options.length === 0) {
          const [macauFallback, zhuhaiFallback] = await Promise.all([
            searchWithPlaceSearch('澳门', `澳门特别行政区 ${keyword}`),
            searchWithPlaceSearch('珠海', `珠海市 ${keyword}`)
          ]);

          options = [...macauFallback, ...zhuhaiFallback].filter(
            (item, index, arr) => arr.findIndex((x) => x.placeId === item.placeId) === index
          );
        }

        if (!cancelled) {
          setGeocodeResults(options);
        }
      } catch (error) {
        if (!cancelled) {
          setGeocodeResults([]);
          setContributeError(error instanceof Error ? error.message : tContribute('searchFailed'));
        }
      } finally {
        if (!cancelled) {
          setGeocodeLoading(false);
        }
      }
    };

    runGeocode();

    return () => {
      cancelled = true;
    };
  }, [debouncedGeocodeQuery, manualMode, tContribute]);

  const handleChoosePlace = async (option: GeocodeOption) => {
    setSelectedPlace(option);
    setContributeError(null);
    setContributeMessage(null);
    setDuplicateLoading(true);

    let data: {id: string}[] | null = null;
    let queryError: {message: string} | null = null;

    const primaryResult = await supabase.from('shops').select('id').eq('amap_poi_id', option.placeId).limit(1);

    if (primaryResult.error) {
      const fallbackResult = await supabase.from('shops').select('id').eq('mapbox_id', option.placeId).limit(1);
      data = fallbackResult.data as {id: string}[] | null;
      queryError = fallbackResult.error ? {message: fallbackResult.error.message} : null;
    } else {
      data = primaryResult.data as {id: string}[] | null;
    }

    setDuplicateLoading(false);

    if (queryError) {
      setIsDuplicate(false);
      setContributeError(queryError.message);
      return;
    }

    const duplicate = (data ?? []).length > 0;
    setIsDuplicate(duplicate);

    if (duplicate) {
      setContributeMessage('检测到同地点已存在店铺：本次会进入待审核队列，不会直接上线。');
    }
  };

  const handleUploadImage = async (file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `shops/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const {error: uploadError} = await supabase.storage.from('shop-images').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });

    if (uploadError) {
      setContributeError(uploadError.message);
      return;
    }

    const {data} = supabase.storage.from('shop-images').getPublicUrl(filePath);
    setImageUrls((prev) => [...prev, data.publicUrl]);
    setContributeMessage('图片已添加');
  };

  const handleSubmitContribute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const canSubmitFromSearch = !!selectedPlace;
    const canSubmitFromManual = manualMode && !!manualCoordinates && manualShopName.trim().length > 0;

    if ((!canSubmitFromSearch && !canSubmitFromManual) || submitLoading) return;

    if (!category || !shopType) {
      setContributeError('请完整填写主分类和子类型');
      return;
    }

    setSubmitLoading(true);
    setContributeError(null);
    setContributeMessage(null);

    const tags = Array.from(
      new Set(
        tagsInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, 5);

    const payloadBase = {
      tags,
      features: selectedFeatures,
      shop_type: shopType,
      rating_label: selectedRating.label,
      rating: selectedRating.value,
      image_urls: imageUrls,
      review_text: reviewText.trim() || null,
      category,
      status: 'pending',
      total_sum: selectedRating.value,
      rating_count: 1,
      review_count: 1
    };

    const payload = canSubmitFromSearch
      ? {
          ...payloadBase,
          name: selectedPlace!.name,
          amap_poi_id: selectedPlace!.placeId,
          longitude: selectedPlace!.coordinates[0],
          latitude: selectedPlace!.coordinates[1]
        }
      : {
          ...payloadBase,
          name: manualShopName.trim(),
          amap_poi_id: null,
          longitude: manualCoordinates![0],
          latitude: manualCoordinates![1]
        };

    const {error} = await supabase.from('shops').insert(payload);

    setSubmitLoading(false);

    if (error) {
      setContributeError(error.message);
      return;
    }

    setContributeMessage(tContribute('submitSuccess'));
    await onSuccess();
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{tContribute('title')}</h2>
          <p className="mt-1 text-sm text-slate-600">{tContribute('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {tContribute('button')}
        </button>
      </div>

      {!manualMode && (
        <>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{tContribute('searchLabel')}</label>
            <input
              type="text"
              value={geocodeQuery}
              onChange={(e) => {
                setGeocodeQuery(e.target.value);
                setSelectedPlace(null);
                setIsDuplicate(false);
                setContributeError(null);
                setContributeMessage(null);
              }}
              placeholder={tContribute('searchPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />

            {geocodeLoading && <p className="mt-2 text-sm text-slate-500">{tContribute('searching')}</p>}

            {!geocodeLoading && geocodeQuery.trim().length >= 2 && geocodeResults.length === 0 && !selectedPlace && (
              <p className="mt-2 text-sm text-slate-500">{tContribute('searchEmpty')}</p>
            )}

            {geocodeResults.length > 0 && !selectedPlace && (
              <ul className="mt-3 space-y-2">
                {geocodeResults.map((option) => (
                  <li key={option.placeId}>
                    <button
                      type="button"
                      onClick={() => handleChoosePlace(option)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <p className="text-sm font-medium text-slate-900">{option.name}</p>
                      <p className="text-xs text-slate-500">{option.fullAddress}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setManualMode(true);
              setContributeError(null);
              setContributeMessage(null);
              setSelectedPlace(null);
              setGeocodeResults([]);
              onRequestMapPick();
            }}
            className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {tContribute('manualSelectButton')}
          </button>
        </>
      )}

      {manualMode && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
          {manualCoordinates
            ? `${tContribute('manualSelected')}: ${manualCoordinates[1].toFixed(6)}, ${manualCoordinates[0].toFixed(6)}`
            : tContribute('manualSelectHint')}
        </div>
      )}

      {duplicateLoading && <p className="mt-4 text-sm text-slate-500">{tContribute('checkingDuplicate')}</p>}

      {selectedPlace && !manualMode && !duplicateLoading && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{selectedPlace.name}</p>
          <p className="text-xs text-slate-500">{selectedPlace.fullAddress}</p>
          <p className="mt-1 text-xs text-slate-500">AMap POI ID: {selectedPlace.placeId}</p>
        </div>
      )}

      {isDuplicate && !manualMode && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {tContribute('duplicateWarning')}
        </div>
      )}

      {((selectedPlace && !duplicateLoading) || (manualMode && manualCoordinates)) && (
        <form onSubmit={handleSubmitContribute} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">主分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'food' | 'drink' | 'vibe' | 'deal' | '')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              >
                <option value="">请选择</option>
                <option value="food">美食</option>
                <option value="drink">饮品</option>
                <option value="vibe">氛围</option>
                <option value="deal">优惠</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">子类型</label>
              <select
                value={shopType}
                onChange={(e) => setShopType(e.target.value as (typeof SHOP_TYPE_OPTIONS)[number] | '')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              >
                <option value="">请选择</option>
                {SHOP_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {manualMode && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{tContribute('manualNameLabel')}</label>
              <input
                type="text"
                value={manualShopName}
                onChange={(e) => setManualShopName(e.target.value)}
                placeholder={tContribute('manualNamePlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">评价标签</label>
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setSelectedRatingLabel(option.label)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    selectedRatingLabel === option.label
                      ? 'border-[#006633] bg-[#006633] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">特色（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((feature) => {
                const checked = selectedFeatures.includes(feature);
                return (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => {
                      setSelectedFeatures((prev) =>
                        checked ? prev.filter((item) => item !== feature) : [...prev, feature]
                      );
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      checked ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {feature}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">标签（逗号分隔，最多5个）</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={tContribute('tagsPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">图片（可选）</label>
            <ImageUpload onUpload={handleUploadImage} />
            {imageUrls.length > 0 && <p className="mt-1 text-xs text-emerald-600">已上传 {imageUrls.length} 张图片</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{tContribute('reviewLabel')}</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              placeholder={tContribute('reviewPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitLoading}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLoading ? tContribute('submitting') : tContribute('submit')}
          </button>
        </form>
      )}

      {contributeError && <p className="mt-4 text-sm text-rose-600">{contributeError}</p>}
      {contributeMessage && <p className="mt-4 text-sm text-emerald-600">{contributeMessage}</p>}
    </section>
  );
}
