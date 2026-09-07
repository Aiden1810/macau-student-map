'use client';

import {useEffect, useId, useState} from 'react';
import {useDebounce} from '@/lib/hooks/useDebounce';
import {searchAmapPoiOptions, type AmapPoiOption} from '@/lib/amap/place-search';

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
};

export default function AmapPoiSelector({
  selectedPlace,
  onSelect,
  onClearSelection,
  labels
}: AmapPoiSelectorProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<AmapPoiOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void searchAmapPoiOptions(amapKey, keyword, labels.unnamedPlace)
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
  }, [debouncedQuery, labels.searchFailed, labels.unnamedPlace]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">{labels.label}</label>
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
                <p className="text-sm font-medium text-slate-900">{option.name}</p>
                <p className="text-xs text-slate-500">{option.fullAddress}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedPlace && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{selectedPlace.name}</p>
          <p className="text-xs text-slate-500">{selectedPlace.fullAddress}</p>
          <p className="mt-1 text-xs text-slate-500">{labels.poiId}: {selectedPlace.placeId}</p>
        </div>
      )}
    </div>
  );
}
