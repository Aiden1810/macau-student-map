'use client';

import {FormEvent, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {getCanonicalTagsForAdminAndSubmit} from '@/lib/tags/schema';
import LaunchCategorySelector from '@/components/LaunchCategorySelector';
import {getLaunchTagOptions, isPrimaryTag, selectLaunchCategory, type LaunchCategoryKey} from '@/lib/domain/place-types';
import {findTaxonomyTag, getTaxonomyTagLabelZhCN} from '@/lib/domain/taxonomy';
import AmapPoiSelector from '@/components/AmapPoiSelector';
import ImageUpload from '@/components/ImageUpload';
import type {AmapPoiOption, AmapPoiSearchOrigin} from '@/lib/amap/place-search';
import {authenticatedApiRequest} from '@/lib/api/client';
import type {PlaceCategorySlug} from '@/lib/domain/taxonomy';
import {supabase} from '@/lib/supabase';

interface ContributionFormProps {
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
  const [manualShopName, setManualShopName] = useState('');

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
            onClick={() => {
              setManualMode(true);
              setContributeError(null);
              setContributeMessage(null);
              setSelectedPlace(null);
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
            <label className="mb-1 block text-sm font-medium text-slate-700">消费参考 (MOP/人次) <span className="font-normal text-slate-400">（可选；请勿填写每小时或包场总价）</span></label>
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
