'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {getCanonicalTagsForAdminAndSubmit} from '@/lib/tags/schema';
import LaunchCategorySelector from '@/components/LaunchCategorySelector';
import PrimaryTagSelector from '@/components/PrimaryTagSelector';
import {getLaunchTagOptions, isPrimaryTag, selectLaunchCategory, type LaunchCategoryKey} from '@/lib/domain/place-types';
import {findTaxonomyTag, getTaxonomyTagLabelZhCN} from '@/lib/domain/taxonomy';
import AmapPoiSelector from '@/components/AmapPoiSelector';
import LocationDetailsFields from '@/components/LocationDetailsFields';
import {readLocationDetails, requiresLocationDescription} from '@/lib/domain/location-details';
import ImageUpload from '@/components/ImageUpload';
import type {AmapPoiOption, AmapPoiSearchOrigin} from '@/lib/amap/place-search';
import {authenticatedApiRequest} from '@/lib/api/client';
import type {PlaceCategorySlug} from '@/lib/domain/taxonomy';
import {supabase} from '@/lib/supabase';

interface ContributionFormProps {
  onBusyChange?: (busy: boolean) => void;
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
  onRequestMapPick: () => void;
  manualCoordinates: [number, number] | null;
  poiSearchOrigin?: AmapPoiSearchOrigin | null;
}



type SubmissionDraftResponse = {
  id: string;
  version: number;
};

type DuplicateCandidate = {id: string; name: string; distanceMeters: number};

type SubmitResponse =
  | {submitted: true; submission: SubmissionDraftResponse}
  | {submitted: false; duplicateCandidates: DuplicateCandidate[]};

export default function ContributionForm({
  onBusyChange,
  onSuccess,
  onCancel,
  onRequestMapPick,
  manualCoordinates,
  poiSearchOrigin = null
}: ContributionFormProps) {
  const tContribute = useTranslations('Contribute');

  const [selectedPlace, setSelectedPlace] = useState<AmapPoiOption | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [manualMode, setManualMode] = useState(false);
  const [contributionKind, setContributionKind] = useState<'store' | 'stall'>('store');
  const [manualShopName, setManualShopName] = useState('');
  const [locationDetails, setLocationDetails] = useState(() => readLocationDetails());
  const [referencePoi, setReferencePoi] = useState<AmapPoiOption | null>(null);
  const [usingLandmark, setUsingLandmark] = useState(false);
  // Only a new map click can confirm a point after changing the location source.
  const [discardedManualPoint, setDiscardedManualPoint] = useState<[number, number] | null>(null);
  const manualPoint = usingLandmark ? referencePoi?.coordinates ?? null
    : manualCoordinates !== discardedManualPoint ? manualCoordinates : null;

  const [category, setCategory] = useState<PlaceCategorySlug | ''>('');
  const [launchCategory, setLaunchCategory] = useState<LaunchCategoryKey | null>(null);
  const [selectedPresetTagIds, setSelectedPresetTagIds] = useState<string[]>([]);
  const [expandedSecondaryTagGroups, setExpandedSecondaryTagGroups] = useState(false);

  const [pricePerPerson, setPricePerPerson] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [uploadedMediaCount, setUploadedMediaCount] = useState(0);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const imageProcessingRef = useRef(false);
  const operationRef = useRef<'submit' | 'cancel' | null>(null);
  const busy = submitLoading || imageProcessing || cancelLoading;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => {onBusyChange?.(false);};
  }, [busy, onBusyChange]);
  const [contributeMessage, setContributeMessage] = useState<string | null>(null);
  const [contributeError, setContributeError] = useState<string | null>(null);

  const clearLocationFeedback = () => {
    setContributeError(null); setContributeMessage(null);
    setIsDuplicate(false); setDuplicateCandidates([]);
  };

  const chooseContributionKind = (kind: 'store' | 'stall') => {
    setContributionKind(kind);
    setLocationDetails(current => ({...current, businessForm: kind}));
    clearLocationFeedback();
    // Use the suggested method only for an empty form; keep any entered place information.
    if (!selectedPlace && !manualPoint && !manualShopName.trim() && !locationDetails.description && !draftId) {
      setManualMode(kind === 'stall');
      setDiscardedManualPoint(manualCoordinates);
      setLocationDetails(current => ({...current, businessForm: kind, source: kind === 'stall' ? 'manual' : 'unknown', accuracy: 'unknown'}));
    }
  };

  const startManualLocation = () => {
    setManualMode(true); setSelectedPlace(null); setReferencePoi(null); setUsingLandmark(false);
    setDiscardedManualPoint(manualCoordinates);
    setLocationDetails(current => ({...current, businessForm: contributionKind, source: 'manual', accuracy: 'unknown'}));
    clearLocationFeedback();
    onRequestMapPick();
  };

  const returnToPlaceSearch = () => {
    setManualMode(false); setSelectedPlace(null); setReferencePoi(null); setUsingLandmark(false);
    setDiscardedManualPoint(manualCoordinates);
    setLocationDetails(current => ({...current, businessForm: contributionKind, source: 'unknown', accuracy: 'unknown'}));
    clearLocationFeedback();
  };

  const allL2Groups = useMemo(() => {
    const canonical = getCanonicalTagsForAdminAndSubmit();

    return canonical.map((group) => ({
      id: group.level1,
      title: `${group.level1}标签`,
      tags: group.options.map((option) => ({id: option.tag_id, name: option.tag_name}))
    }));
  }, []);

  const primaryTagGroup = useMemo(() => {
    if (!launchCategory) return null;
    return {title: '地点类型', tags: getLaunchTagOptions(launchCategory).map(tag => ({id: tag.id, name: getTaxonomyTagLabelZhCN(tag.slug)!}))};
  }, [launchCategory]);

  const secondaryTagGroups = useMemo(() => {
    return allL2Groups.map(group => ({...group, tags: group.tags.filter(option => {
      const tag = findTaxonomyTag(option.id);
      return tag && !isPrimaryTag(tag);
    })})).filter(group => group.tags.length > 0);
  }, [allL2Groups]);

  const handleChoosePlace = (option: AmapPoiOption) => {
    setSelectedPlace(option);
    setLocationDetails(current => ({...current, source: 'map', accuracy: 'unknown'}));
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
    const canUseSearch = !manualMode && !!selectedPlace;
    const canUseManual = manualMode && !!manualPoint && manualShopName.trim().length > 0;
    if ((!canUseSearch && !canUseManual) || !category) {
      throw new Error('请先完成地点、名称和主分类。');
    }
    const normalizedTagIds = Array.from(new Set(selectedPresetTagIds));
    if (normalizedTagIds.length === 0) {
      throw new Error('请至少选择 1 个标准标签。');
    }
    if (normalizedTagIds.length > 8) {
      throw new Error('最多选择 8 个标签，请手动调整后再继续。');
    }
    if (!primaryTagGroup?.tags.some(tag => normalizedTagIds.includes(tag.id))) {
      throw new Error('请至少选择 1 个实际提供的地点类型。');
    }

    const coordinates = canUseSearch ? selectedPlace!.coordinates : manualPoint!;
    return {
      sourcePlaceId: null,
      name: canUseSearch ? selectedPlace!.name : manualShopName.trim(),
      address: canUseSearch ? selectedPlace!.fullAddress || null : null,
      locationDetails: {...locationDetails, businessForm: contributionKind, source: canUseSearch ? 'map' : 'manual',
        accuracy: manualMode && usingLandmark ? 'approximate' : locationDetails.accuracy},
      categorySlug: category,
      region: null,
      longitude: coordinates[0],
      latitude: coordinates[1],
      pricePerPerson: pricePerPerson.trim() ? Number(pricePerPerson) : null,
      tagIds: normalizedTagIds,
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
    if (operationRef.current) return;
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

    const canSubmitFromSearch = !manualMode && !!selectedPlace;
    const canSubmitFromManual = manualMode && !!manualPoint && manualShopName.trim().length > 0;

    if (operationRef.current || imageProcessingRef.current) return;
    if (!canSubmitFromSearch && !canSubmitFromManual) {
      setContributeError('请填写地点名称，并选择地图位置或附近地标。'); return;
    }
    if (manualMode && requiresLocationDescription(readLocationDetails({...locationDetails, source: 'manual'}))) {
      setContributeError('请填写位置描述，说明到附近后怎么找到这个地点。'); return;
    }

    if (!category) {
      setContributeError('请选择店铺主分类');
      return;
    }

    operationRef.current = 'submit';
    setSubmitLoading(true);
    setContributeError(null);
    setContributeMessage(null);

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
      operationRef.current = null;
      setSubmitLoading(false);
    }
  };

  const handleCancel = async () => {
    if (operationRef.current || imageProcessingRef.current) return;
    if (!draftId) {
      onCancel();
      return;
    }

    operationRef.current = 'cancel';
    setCancelLoading(true);
    setContributeError(null);
    try {
      const accessToken = await getAccessToken();
      await authenticatedApiRequest(`/api/submissions/${draftId}`, accessToken, {method: 'DELETE'});
      onCancel();
    } catch (error) {
      setContributeError(error instanceof Error ? error.message : '草稿清理失败，请稍后重试。');
    } finally {
      operationRef.current = null;
      setCancelLoading(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <fieldset disabled={busy} className="min-w-0">
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
          {tContribute('close')}
        </button>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-slate-800">{tContribute('kindLabel')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['store', 'stall'] as const).map(kind => <button key={kind} type="button"
            aria-label={tContribute(kind === 'store' ? 'kindStore' : 'kindStall')}
            aria-pressed={contributionKind === kind} disabled={submitLoading} onClick={() => chooseContributionKind(kind)}
            className={`min-h-20 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-60 ${contributionKind === kind ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            <span className="block text-sm font-semibold">{tContribute(kind === 'store' ? 'kindStore' : 'kindStall')}</span>
            <span className="mt-1 block text-xs leading-5">{tContribute(kind === 'store' ? 'kindStoreDescription' : 'kindStallDescription')}</span>
          </button>)}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{tContribute(contributionKind === 'store' ? 'storeLocationHint' : 'stallLocationHint')}</p>
      </fieldset>

      {!manualMode && (
        <>
          <div className="mt-4">
            <AmapPoiSelector
              selectedPlace={selectedPlace}
              searchOrigin={poiSearchOrigin}
              onSelect={handleChoosePlace}
              onClearSelection={() => {
                setSelectedPlace(null);
                setIsDuplicate(false);
                setContributeError(null);
                setContributeMessage(null);
              }}
              labels={{
                label: tContribute('searchLabel'),
                placeholder: tContribute('searchPlaceholder'),
                searching: tContribute('searching'),
                empty: tContribute('searchEmpty'),
                searchFailed: tContribute('searchFailed'),
                unnamedPlace: tContribute('unnamedPlace'),
                poiId: 'AMap POI ID'
              }}
            />
          </div>

          <button
            type="button"
            onClick={startManualLocation}
            className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {tContribute('manualSelectButton')}
          </button>
        </>
      )}

      {manualMode && (
        <div className="mt-4 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
          <p>{manualPoint
            ? `${usingLandmark ? '已使用附近地标的大致位置' : tContribute('manualSelected')}: ${manualPoint[1].toFixed(6)}, ${manualPoint[0].toFixed(6)}`
            : tContribute('manualSelectHint')}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="min-h-10 underline" onClick={() => {setDiscardedManualPoint(manualCoordinates); setUsingLandmark(false); setLocationDetails(current => ({...current, source: 'manual', accuracy: 'unknown'})); onRequestMapPick();}}>{manualPoint ? '重新在地图标点' : '在地图标点'}</button>
            <button type="button" className="min-h-10 underline" onClick={returnToPlaceSearch}>返回搜索店铺</button>
          </div>
          <AmapPoiSelector selectedPlace={referencePoi} searchOrigin={poiSearchOrigin}
            onSelect={poi => {setDiscardedManualPoint(manualCoordinates); setReferencePoi(poi); setUsingLandmark(true); setLocationDetails(current => ({...current, source: 'manual', landmark: poi.name, accuracy: 'approximate'}));}}
            onClearSelection={() => {setReferencePoi(null); setUsingLandmark(false); setLocationDetails(current => ({...current, landmark: null, accuracy: 'unknown'}));}}
            labels={{label: '搜索附近地标（可选）', placeholder: '搜索附近的店铺、楼宇或公交站', searching: '搜索中…', empty: '未找到地标，可以直接地图标点', searchFailed: '搜索失败，请重试', unnamedPlace: '未命名地点', poiId: '地标编号'}} />
          <p className="text-xs">地标只用于说明位置，不会把你的地点改成地标店铺。</p>
        </div>
      )}

      {isDuplicate && (
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

      {(selectedPlace || manualMode) && (
        <form onSubmit={handleSubmitContribute} className="mt-4 space-y-4">
          <div>
            <LaunchCategorySelector value={launchCategory} onChange={(key) => {
              const next = selectLaunchCategory(key, selectedPresetTagIds);
              setLaunchCategory(key);
              setCategory(next.category);
              setSelectedPresetTagIds(next.tagIds);
              setExpandedSecondaryTagGroups(false);
            }} />
          </div>

          {manualMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700"><span className="mb-1 block">{tContribute('manualNameLabel')}</span>
              <input
                type="text"
                maxLength={120}
                value={manualShopName}
                onChange={(e) => setManualShopName(e.target.value)}
                placeholder={tContribute('manualNamePlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
              </label>
            </div>
          )}

          <LocationDetailsFields value={locationDetails} onChange={setLocationDetails} showBusinessForm={false} required approximateOnly={manualMode && usingLandmark} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">消费参考（人民币／人次） <span className="font-normal text-slate-400">（可选；请勿填写每小时或包场总价）</span></label>
            <input
              type="number"
              value={pricePerPerson}
              onChange={(e) => setPricePerPerson(e.target.value)}
              placeholder="例如：65"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <label className="mb-3 block text-sm font-medium text-slate-700">这家店属于哪一类？</label>

            {category && primaryTagGroup && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-emerald-800">优先选择：{primaryTagGroup.title}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700">至少选择 1 个</span>
                </div>
                <PrimaryTagSelector tags={getLaunchTagOptions(launchCategory!)} selected={selectedPresetTagIds}
                  onToggle={id => setSelectedPresetTagIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} />
              </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">还可以补充（可选）</p>
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
            <ImageUpload onUpload={handleUploadImage} disabled={busy} onProcessingChange={processing => {
              imageProcessingRef.current = processing;
              setImageProcessing(processing);
            }} />
            {uploadedMediaCount > 0 && (
              <p className="mt-1 text-xs text-emerald-600">已安全上传 {uploadedMediaCount} 张图片到当前草稿</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLoading ? tContribute('submitting') : tContribute('submit')}
          </button>
        </form>
      )}

      {contributeError && <p className="mt-4 text-sm text-rose-600">{contributeError}</p>}
      {contributeMessage && <p className="mt-4 text-sm text-emerald-600">{contributeMessage}</p>}
      </fieldset>
    </section>
  );
}
