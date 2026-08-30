'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {getCanonicalTagsForAdminAndSubmit} from '@/lib/tags/schema';
import ImageUpload from '@/components/ImageUpload';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {authenticatedApiRequest} from '@/lib/api/client';
import type {PlaceCategorySlug} from '@/lib/domain/taxonomy';
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

const CATEGORY_L1_BY_KEY: Record<string, string> = {
  food: '美食',
  shopping: '购物',
  entertainment: '娱乐',
  service: '生活服务'
};

type SubmissionDraftResponse = {
  id: string;
  version: number;
};

type DuplicateCandidate = {id: string; name: string; distanceMeters: number};

type SubmitResponse =
  | {submitted: true; submission: SubmissionDraftResponse}
  | {submitted: false; duplicateCandidates: DuplicateCandidate[]};

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

  const [manualMode, setManualMode] = useState(false);
  const [manualShopName, setManualShopName] = useState('');

  const [category, setCategory] = useState<PlaceCategorySlug | ''>('');
  const [selectedPresetTagIds, setSelectedPresetTagIds] = useState<string[]>([]);
  const [expandedSecondaryTagGroups, setExpandedSecondaryTagGroups] = useState(false);

  const [pricePerPerson, setPricePerPerson] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [uploadedMediaCount, setUploadedMediaCount] = useState(0);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [contributeMessage, setContributeMessage] = useState<string | null>(null);
  const [contributeError, setContributeError] = useState<string | null>(null);

  const allL2Groups = useMemo(() => {
    const canonical = getCanonicalTagsForAdminAndSubmit();

    return canonical.map((group) => ({
      id: group.level1,
      title: `${group.level1}标签`,
      tags: group.options.map((option) => ({id: option.tag_id, name: option.tag_name}))
    }));
  }, []);

  const primaryTagGroup = useMemo(() => {
    if (!category) return null;
    const l1 = CATEGORY_L1_BY_KEY[category];
    return allL2Groups.find((group) => group.id === l1) ?? null;
  }, [allL2Groups, category]);

  const secondaryTagGroups = useMemo(() => {
    if (!category) return allL2Groups;
    const l1 = CATEGORY_L1_BY_KEY[category];
    return allL2Groups.filter((group) => group.id !== l1);
  }, [allL2Groups, category]);

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

  const handleChoosePlace = (option: GeocodeOption) => {
    setSelectedPlace(option);
    setContributeError(null);
    setContributeMessage(null);
    setDuplicateCandidates([]);
    setIsDuplicate(false);
  };

  const getAccessToken = async () => {
    const {data, error} = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('请先登录后再投稿。');
    }
    return data.session.access_token;
  };

  const buildDraftPayload = () => {
    const canUseSearch = !!selectedPlace;
    const canUseManual = manualMode && !!manualCoordinates && manualShopName.trim().length > 0;
    if ((!canUseSearch && !canUseManual) || !category) {
      throw new Error('请先完成地点、名称和主分类。');
    }
    if (selectedPresetTagIds.length === 0) {
      throw new Error('请至少选择 1 个标准标签。');
    }

    const coordinates = canUseSearch ? selectedPlace!.coordinates : manualCoordinates!;
    return {
      sourcePlaceId: null,
      name: canUseSearch ? selectedPlace!.name : manualShopName.trim(),
      address: canUseSearch ? selectedPlace!.fullAddress || null : null,
      categorySlug: category,
      region: null,
      longitude: coordinates[0],
      latitude: coordinates[1],
      pricePerPerson: pricePerPerson.trim() ? Number(pricePerPerson) : null,
      tagIds: Array.from(new Set(selectedPresetTagIds)).slice(0, 20),
      notes: canUseSearch ? `AMap POI: ${selectedPlace!.placeId}` : null,
      version: draftVersion
    };
  };

  const saveDraft = async (): Promise<{draft: SubmissionDraftResponse; accessToken: string}> => {
    const accessToken = await getAccessToken();
    const payload = buildDraftPayload();
    const draft = await authenticatedApiRequest<SubmissionDraftResponse>(
      draftId ? `/api/submissions/${draftId}` : '/api/submissions',
      accessToken,
      {
        method: draftId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      }
    );
    setDraftId(draft.id);
    setDraftVersion(draft.version);
    return {draft, accessToken};
  };

  const handleUploadImage = async (file: File) => {
    setContributeError(null);
    try {
      const {draft, accessToken} = await saveDraft();
      const formData = new FormData();
      formData.set('file', file);
      formData.set('submissionId', draft.id);
      formData.set('altText', `${buildDraftPayload().name} 投稿图片`);
      await authenticatedApiRequest('/api/media/submission-upload', accessToken, {
        method: 'POST',
        body: formData
      });
      setUploadedMediaCount((count) => count + 1);
      setContributeMessage('草稿已保存，图片已安全上传。');
    } catch (error) {
      setContributeError(error instanceof Error ? error.message : '图片上传失败。');
    }
  };

  const handleSubmitContribute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const canSubmitFromSearch = !!selectedPlace;
    const canSubmitFromManual = manualMode && !!manualCoordinates && manualShopName.trim().length > 0;

    if ((!canSubmitFromSearch && !canSubmitFromManual) || submitLoading) return;

    if (!category) {
      setContributeError('请选择店铺主分类');
      return;
    }

    setSubmitLoading(true);
    setContributeError(null);
    setContributeMessage(null);

    const normalizedTagIds = Array.from(new Set(selectedPresetTagIds)).slice(0, 8);

    if (normalizedTagIds.length === 0) {
      setSubmitLoading(false);
      setContributeError('请至少选择1个标准标签');
      return;
    }

    try {
      const {draft, accessToken} = await saveDraft();
      const result = await authenticatedApiRequest<SubmitResponse>(
        `/api/submissions/${draft.id}/submit`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            confirmedDuplicateIds: duplicateCandidates.map((candidate) => candidate.id)
          })
        }
      );

      if (!result.submitted) {
        setDuplicateCandidates(result.duplicateCandidates);
        setIsDuplicate(true);
        setContributeMessage(
          `发现 ${result.duplicateCandidates.length} 个 200 米内的相似地点。请核对后再次点击提交以确认进入审核。`
        );
        return;
      }

      setContributeMessage(tContribute('submitSuccess'));
      await onSuccess();
    } catch (error) {
      setContributeError(error instanceof Error ? error.message : '投稿提交失败。');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!draftId) {
      onCancel();
      return;
    }

    setContributeError(null);
    try {
      const accessToken = await getAccessToken();
      await authenticatedApiRequest(`/api/submissions/${draftId}`, accessToken, {method: 'DELETE'});
      onCancel();
    } catch (error) {
      setContributeError(error instanceof Error ? error.message : '草稿清理失败，请稍后重试。');
    }
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
          onClick={handleCancel}
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

      {selectedPlace && !manualMode && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{selectedPlace.name}</p>
          <p className="text-xs text-slate-500">{selectedPlace.fullAddress}</p>
          <p className="mt-1 text-xs text-slate-500">AMap POI ID: {selectedPlace.placeId}</p>
        </div>
      )}

      {isDuplicate && !manualMode && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {tContribute('duplicateWarning')}
          {duplicateCandidates.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {duplicateCandidates.map((candidate) => (
                <li key={candidate.id}>
                  {candidate.name}（约 {Math.round(candidate.distanceMeters)} 米）
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(selectedPlace || (manualMode && manualCoordinates)) && (
        <form onSubmit={handleSubmitContribute} className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              店铺主分类 <span className="font-normal text-slate-400">（决定基础展示位置，可跨界组合下方标签）</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: 'food', label: '美食' },
                { value: 'shopping', label: '购物' },
                { value: 'entertainment', label: '娱乐' },
                { value: 'service', label: '生活服务' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCategory(opt.value as PlaceCategorySlug);
                    setSelectedPresetTagIds([]);
                    setExpandedSecondaryTagGroups(false);
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    category === opt.value
                      ? 'border-[#006633] bg-[#006633] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">人均消费 (MOP/人) <span className="font-normal text-slate-400">（可选）</span></label>
            <input
              type="number"
              value={pricePerPerson}
              onChange={(e) => setPricePerPerson(e.target.value)}
              placeholder="例如：65"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <label className="mb-3 block text-sm font-medium text-slate-700">全库扩展标签（可跨类多选）</label>

            {category && primaryTagGroup && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-emerald-800">主分类优先：{primaryTagGroup.title}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700">推荐优先选择</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {primaryTagGroup.tags.map((tag) => {
                    const checked = selectedPresetTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetTagIds((prev) =>
                            checked ? prev.filter((item) => item !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          checked
                            ? 'border-[#006633] bg-[#006633] text-white shadow-sm'
                            : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">其他标签组（次级）</p>
              <button
                type="button"
                onClick={() => setExpandedSecondaryTagGroups((prev) => !prev)}
                className="text-xs font-medium text-[#006633] hover:underline"
              >
                {expandedSecondaryTagGroups ? '收起其他标签' : '展开其他标签'}
              </button>
            </div>

            {expandedSecondaryTagGroups && (
              <div className="space-y-4">
                {secondaryTagGroups.map((group) => (
                  <div key={group.id}>
                    <p className="mb-2 text-xs font-semibold text-slate-500">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => {
                        const checked = selectedPresetTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              setSelectedPresetTagIds((prev) =>
                                checked ? prev.filter((item) => item !== tag.id) : [...prev, tag.id]
                              );
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              checked ? 'border-[#006633] bg-[#006633] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">图片（可选）</label>
            <ImageUpload onUpload={handleUploadImage} />
            {uploadedMediaCount > 0 && (
              <p className="mt-1 text-xs text-emerald-600">已安全上传 {uploadedMediaCount} 张图片到当前草稿</p>
            )}
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
