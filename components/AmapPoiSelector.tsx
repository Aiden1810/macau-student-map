'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {
  searchAmapPoiOptions,
  type AmapPoiOption,
  type AmapPoiSearchOrigin,
  type AmapSearchScope
} from '@/lib/amap/place-search';

type AmapPoiSelectorLabels = {
  label: string;
  placeholder: string;
  searching: string;
  empty: string;
  searchFailed: string;
  unnamedPlace: string;
  poiId: string;
};

type AmapPoiSelectorProps = {
  selectedPlace: AmapPoiOption | null;
  onSelect: (option: AmapPoiOption) => void;
  onClearSelection?: () => void;
  labels: AmapPoiSelectorLabels;
  searchOrigin?: AmapPoiSearchOrigin | null;
};

export default function AmapPoiSelector({
  selectedPlace,
  onSelect,
  onClearSelection,
  labels,
  searchOrigin = null
}: AmapPoiSelectorProps) {
  const inputId = useId();
  const t = useTranslations('Contribute');
  const [scope, setScope] = useState<AmapSearchScope>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<AmapPoiOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchOriginRef = useRef(searchOrigin);
  searchOriginRef.current = searchOrigin;

  const getCityLabel = (option: AmapPoiOption) => {
    if (option.city === 'macau') return t('poiCityMacau');
    if (option.city === 'zhuhai') return t('poiCityZhuhai');
    return null;
  };

  const getDistanceLabel = (option: AmapPoiOption) => {
    if (option.distanceMeters === undefined || !option.distanceSource) return null;
    if (option.distanceMeters < 1000) {
      const distance = Math.round(option.distanceMeters);
      return option.distanceSource === 'user'
        ? t('poiDistanceFromYouMeters', {distance})
        : t('poiDistanceFromMapMeters', {distance});
    }

    const distance = (option.distanceMeters / 1000).toFixed(1);
    return option.distanceSource === 'user'
      ? t('poiDistanceFromYouKilometers', {distance})
      : t('poiDistanceFromMapKilometers', {distance});
  };

  useEffect(() => {
    let cancelled = false;
    const keyword = debouncedQuery.trim();
    const amapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY;

    if (!amapKey || keyword.length < 2) {
      setResults([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    const originAtSearchTime = searchOriginRef.current;
    void searchAmapPoiOptions(amapKey, keyword, labels.unnamedPlace, scope, originAtSearchTime)
      .then((options) => {
        if (!cancelled) setResults(options);
      })
      .catch((searchError) => {
        if (cancelled) return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : labels.searchFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, labels.searchFailed, labels.unnamedPlace, scope]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">{labels.label}</label>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label htmlFor={`${inputId}-scope`} className="text-xs text-slate-500">{t('searchScope')}</label>
        <select id={`${inputId}-scope`} value={scope}
          onChange={event => {
            setScope(event.target.value as AmapSearchScope);
            setResults([]);
            setError(null);
            onClearSelection?.();
          }}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700">
          <option value="all">{t('searchBothCities')}</option>
          <option value="macau">{t('searchMacau')}</option>
          <option value="zhuhai">{t('searchZhuhai')}</option>
        </select>
      </div>
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setResults([]);
          setError(null);
          onClearSelection?.();
        }}
        placeholder={labels.placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />

      {loading && <p className="mt-2 text-sm text-slate-500">{labels.searching}</p>}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      {!loading && !error && query.trim().length >= 2 && results.length === 0 && !selectedPlace && (
        <p className="mt-2 text-sm text-slate-500">{labels.empty}</p>
      )}

      {results.length > 0 && !selectedPlace && (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {results.map((option) => (
            <li key={option.placeId}>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  onSelect(option);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900">{option.name}</p>
                  {getCityLabel(option) && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {getCityLabel(option)}
                    </span>
                  )}
                  {getDistanceLabel(option) && (
                    <span className="text-[11px] font-medium text-sky-700">{getDistanceLabel(option)}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{option.fullAddress}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedPlace && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900">{selectedPlace.name}</p>
            {getCityLabel(selectedPlace) && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {getCityLabel(selectedPlace)}
              </span>
            )}
            {getDistanceLabel(selectedPlace) && (
              <span className="text-[11px] font-medium text-sky-700">{getDistanceLabel(selectedPlace)}</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{selectedPlace.fullAddress}</p>
          <p className="mt-1 text-xs text-slate-500">{labels.poiId}: {selectedPlace.placeId}</p>
        </div>
      )}
    </div>
  );
}
