'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {LocateFixed, MapPin, Search, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import {
  searchAmapDiscoveryPlaces,
  type AmapDiscoveryCategory,
  type AmapDiscoveryCity,
  type AmapPoiOption,
  type AmapPoiSearchOrigin
} from '@/lib/amap/place-search';

type SearchResult =
  | {status: 'idle' | 'loading' | 'error'}
  | {status: 'ready'; items: AmapPoiOption[]};

const categories: AmapDiscoveryCategory[] = ['food', 'service', 'shopping'];

export default function NearbyPlaceSearch({open, mapCenter, userCoordinates, onClose, onLocate}: {
  open: boolean;
  mapCenter: [number, number] | null;
  userCoordinates: [number, number] | null;
  onClose: () => void;
  onLocate: (place: AmapPoiOption) => void;
}) {
  const t = useTranslations('NearbyDiscovery');
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [city, setCity] = useState<AmapDiscoveryCity>('macau');
  const [category, setCategory] = useState<AmapDiscoveryCategory>('food');
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState<SearchResult>({status: 'idle'});
  const busy = result.status === 'loading';

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    let origin: AmapPoiSearchOrigin | undefined;
    if (action === 'map' && mapCenter) origin = {coordinates: mapCenter, source: 'map'};
    if (action === 'user' && userCoordinates) origin = {coordinates: userCoordinates, source: 'user'};
    pending.current = true;
    setResult({status: 'loading'});
    try {
      const items = await searchAmapDiscoveryPlaces(
        process.env.NEXT_PUBLIC_AMAP_WEB_KEY ?? '',
        {city, category, keyword, origin},
        t('unnamed')
      );
      setResult({status: 'ready', items});
    } catch {
      setResult({status: 'error'});
    } finally {
      pending.current = false;
    }
  }

  return (
    <dialog
      ref={dialog}
      id="nearby-place-search"
      aria-labelledby="nearby-place-search-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl backdrop:bg-slate-900/35 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="nearby-place-search-title" className="text-lg font-semibold">{t('title')}</h2>
        <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-2 hover:bg-slate-100">
          <X size={20} aria-hidden />
        </button>
      </div>
      <form onSubmit={submit} className="mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-medium">
            {t('city')}
            <select value={city} disabled={busy} onChange={(event) => {setCity(event.target.value as AmapDiscoveryCity); setResult({status: 'idle'});}}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 font-normal">
              <option value="macau">{t('macau')}</option>
              <option value="zhuhai">{t('zhuhai')}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t('category')}
            <select value={category} disabled={busy} onChange={(event) => {setCategory(event.target.value as AmapDiscoveryCategory); setResult({status: 'idle'});}}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 font-normal">
              {categories.map((value) => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          {t('keyword')}
          <input value={keyword} disabled={busy} maxLength={80} placeholder={t('placeholder')}
            onChange={(event) => {setKeyword(event.target.value); setResult({status: 'idle'});}}
            className="min-h-10 rounded-lg border border-slate-300 px-3 font-normal" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" value="city" disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            <Search size={16} aria-hidden />{t('searchCity')}
          </button>
          {mapCenter && (
            <button type="submit" value="map" disabled={busy} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">
              {t('searchMap')}
            </button>
          )}
          {userCoordinates && (
            <button type="submit" value="user" disabled={busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">
              <LocateFixed size={16} aria-hidden />{t('searchUser')}
            </button>
          )}
        </div>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">{t('sourceHint')}</p>
      <div className="mt-2 text-sm" role="status">
        {busy && t('loading')}
        {result.status === 'error' && <p className="text-rose-700">{t('error')}</p>}
        {result.status === 'ready' && (result.items.length ? t('count', {count: result.items.length}) : t('empty'))}
      </div>
      {result.status === 'ready' && result.items.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {result.items.map((item) => {
            const navigation = buildAmapNavigationUrl({...item, hasCoordinates: true});
            return (
              <li key={item.placeId} className="space-y-1 p-3">
                <p className="break-words font-medium">{item.name}</p>
                <p className="break-words text-sm text-slate-600">
                  {item.fullAddress}
                  {item.distanceMeters !== undefined && item.distanceSource &&
                    <span className="ml-2">{t(item.distanceSource === 'user' ? 'distanceFromUser' : 'distanceFromMap', {
                      distance: Math.round(item.distanceMeters)
                    })}</span>}
                </p>
                <div className="flex flex-wrap gap-x-4 text-sm font-medium text-emerald-700">
                  {mapCenter && <button type="button" onClick={() => onLocate(item)} className="inline-flex min-h-10 items-center gap-1 hover:underline">
                    <MapPin size={14} aria-hidden />{t('showOnMap')}
                  </button>}
                  {navigation && <a href={navigation} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center hover:underline">
                    {t('directions')}
                  </a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
