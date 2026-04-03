'use client';

import {FormEvent, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import ImageUpload from '@/components/ImageUpload';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {supabase} from '@/lib/supabase';

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
  const [category, setCategory] = useState<string>('');

  const deriveHierarchyFromCategory = (rawCategory: string) => {
    const normalized = rawCategory.trim();

    if (['餐饮', '美食'].includes(normalized)) {
      return {mainCategory: '美食', defaultSubTags: ['值得一试']};
    }

    if (['服务', '校园'].includes(normalized)) {
      return {mainCategory: '氛围', defaultSubTags: ['中规中矩']};
    }

    return {mainCategory: '评价', defaultSubTags: ['中规中矩']};
  };

  const [initialRating, setInitialRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [contributeMessage, setContributeMessage] = useState<string | null>(null);
  const [contributeError, setContributeError] = useState<string | null>(null);

  useEffect(() => {
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
        const searchAmap = async (searchKeyword: string, city: '澳门' | '珠海') => {
          const endpoint = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(amapKey)}&keywords=${encodeURIComponent(searchKeyword)}&city=${encodeURIComponent(city)}&citylimit=true&extensions=base&offset=8&page=1`;
          const response = await fetch(endpoint);

          if (!response.ok) {
            throw new Error(tContribute('searchFailed'));
          }

          const payload = (await response.json()) as {
            status?: string;
            info?: string;
            pois?: Array<{
              id?: string;
              name?: string;
              address?: string;
              pname?: string;
              cityname?: string;
              adname?: string;
              location?: string;
            }>;
          };

          if (payload.status !== '1') {
            throw new Error(payload.info || tContribute('searchFailed'));
          }

          return (payload.pois ?? [])
            .map((poi) => {
              const [lngRaw, latRaw] = (poi.location ?? '').split(',');
              const lng = Number(lngRaw);
              const lat = Number(latRaw);

              if (!poi.id || Number.isNaN(lng) || Number.isNaN(lat)) {
                return null;
              }

              const region = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(' ');
              const address = [region, poi.address].filter(Boolean).join(' ');

              return {
                placeId: String(poi.id),
                name: poi.name?.trim() || tContribute('unnamedPlace'),
                fullAddress: address.trim(),
                coordinates: [lng, lat] as [number, number]
              };
            })
            .filter((item): item is GeocodeOption => item !== null);
        };

        const [macauOptions, zhuhaiOptions] = await Promise.all([
          searchAmap(keyword, '澳门'),
          searchAmap(keyword, '珠海')
        ]);

        let options = [...macauOptions, ...zhuhaiOptions].filter(
          (item, index, arr) => arr.findIndex((x) => x.placeId === item.placeId) === index
        );

        if (options.length === 0) {
          const [macauFallback, zhuhaiFallback] = await Promise.all([
            searchAmap(`澳门特别行政区 ${keyword}`, '澳门'),
            searchAmap(`珠海市 ${keyword}`, '珠海')
          ]);

          options = [...macauFallback, ...zhuhaiFallback].filter(
            (item, index, arr) => arr.findIndex((x) => x.placeId === item.placeId) === index
          );
        }

        setGeocodeResults(options);
      } catch (error) {
        setGeocodeResults([]);
        setContributeError(error instanceof Error ? error.message : tContribute('searchFailed'));
      } finally {
        setGeocodeLoading(false);
      }
    };

    runGeocode();
  }, [debouncedGeocodeQuery, manualMode, tContribute]);

  const handleChoosePlace = async (option: GeocodeOption) => {
    setSelectedPlace(option);
    setContributeError(null);
    setContributeMessage(null);
    setDuplicateLoading(true);

    const {data, error} = await supabase.from('shops').select('id').eq('mapbox_id', option.placeId).limit(1);

    setDuplicateLoading(false);

    if (error) {
      setIsDuplicate(false);
      setContributeError(error.message);
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

    if (!category) {
      setContributeError('请为该店铺选择一个分类，以便同学们筛选');
      return;
    }

    setSubmitLoading(true);
    setContributeError(null);
    setContributeMessage(null);

    const tags = tagsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const hierarchy = deriveHierarchyFromCategory(category);
    const ratingSubTag = initialRating >= 4.7 ? '封神之作' : initialRating >= 4.2 ? '值得一试' : '中规中矩';
    const explicitRatingTags = tags.filter((tag) => ['封神之作', '值得一试', '中规中矩', '建议避雷', '暂无评分'].includes(tag));

    const subTags = Array.from(new Set([...hierarchy.defaultSubTags, ratingSubTag, ...explicitRatingTags]));
    const mainCategory = hierarchy.mainCategory;

    const safeRating = Number(initialRating.toFixed(1));

    const payload = canSubmitFromSearch
      ? {
          name: selectedPlace!.name,
          mapbox_id: selectedPlace!.placeId,
          longitude: selectedPlace!.coordinates[0],
          latitude: selectedPlace!.coordinates[1],
          tags,
          main_category: mainCategory,
          sub_tags: subTags,
          image_urls: imageUrls,
          review_text: reviewText.trim() || null,
          category,
          status: 'pending',
          total_sum: safeRating,
          rating_count: 1
        }
      : {
          name: manualShopName.trim(),
          mapbox_id: null,
          longitude: manualCoordinates![0],
          latitude: manualCoordinates![1],
          tags,
          main_category: mainCategory,
          sub_tags: subTags,
          image_urls: imageUrls,
          review_text: reviewText.trim() || null,
          category,
          status: 'pending',
          total_sum: safeRating,
          rating_count: 1
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">店铺分类 (Shop Category)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              required
            >
              <option value="">请选择分类</option>
              <option value="餐饮">餐饮 (Food)</option>
              <option value="服务">服务 (Service)</option>
              <option value="购物">购物 (Shopping)</option>
              <option value="校园">校园 (Campus)</option>
              <option value="其他">其他 (Others)</option>
            </select>
          </div>

          {manualMode && (
            <>
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

            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {tContribute('initialRatingLabel')}: {initialRating.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={initialRating}
              onChange={(e) => setInitialRating(Number(e.target.value))}
              className="w-full"
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

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{tContribute('tagsLabel')}</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={tContribute('tagsPlaceholder')}
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
