'use client';

import {useEffect, useRef} from 'react';
import {ArrowUpRight, MapPin, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import type {AmapPoiOption} from '@/lib/amap/place-search';
import type {useNearbyBusinesses} from '@/lib/hooks/useNearbyBusinesses';

export default function DiscoveryHighlights({open, nearby, selected, onClose, onLocate, onManualSearch}: {
  open: boolean;
  nearby: ReturnType<typeof useNearbyBusinesses>;
  selected: AmapPoiOption | null;
  onClose: () => void;
  onLocate: (place: AmapPoiOption) => void;
  onManualSearch: () => void;
}) {
  const t = useTranslations('LiveDiscovery');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  const places = selected ? [selected, ...nearby.items.filter(item => item.placeId !== selected.placeId)] : nearby.items;
  const secondary = 'inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-pine-200/80 bg-pine-50/70 px-3 text-xs font-semibold text-pine-800 transition hover:bg-pine-100/80';
  const primary = 'inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-pine-800 px-3 text-xs font-semibold text-white transition hover:bg-pine-900';
  return (
    <dialog ref={dialog} id="discovery-highlights" aria-labelledby="discovery-highlights-title"
      onCancel={event => {event.preventDefault(); onClose();}}
      className="fixed inset-0 m-auto max-h-[82dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-auto rounded-[24px] border border-line bg-canvas p-0 text-ink shadow-[0_24px_64px_rgba(16,42,29,0.2)] backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-r from-pine-900 to-pine-800 px-5 py-4 text-white sm:px-6">
        <h2 id="discovery-highlights-title" className="text-lg font-semibold tracking-tight">{t('nearby')}</h2>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:bg-white/15"><X size={20} aria-hidden /></button>
      </header>
      <div className="space-y-3 p-4 sm:p-6">
        <p className="text-xs leading-5 text-muted">{t('nearbySource')}</p>
        <div role="status" className="text-sm font-medium text-ink">
          {!nearby.available ? t('zoomHint') : nearby.loading ? t('loading') : nearby.failed ? t('nearbyUnavailable')
            : !nearby.items.length ? t('nearbyEmpty') : nearby.partial ? t('partial', {count: nearby.items.length})
            : t('count', {count: nearby.items.length})}
        </div>
        <div className="flex flex-wrap gap-2">
          {nearby.failed && <button type="button" className={secondary} onClick={nearby.retry}>{t('retry')}</button>}
          <button type="button" className={secondary} onClick={onManualSearch}>{t('manual')}</button>
        </div>
        <ul className="space-y-2.5">{places.map(place => {
          const href = buildAmapNavigationUrl({...place, hasCoordinates: true});
          const isSelected = place.placeId === selected?.placeId;
          return <li key={place.placeId} className={`rounded-[20px] border p-3.5 transition ${isSelected ? 'border-pine-300 bg-pine-50/70 shadow-sm' : 'border-line bg-white'}`}>
            <h3 className="text-[15px] font-semibold text-ink">{place.name}</h3>
            {place.fullAddress && <p className="mt-1 text-xs leading-5 text-muted">{place.fullAddress}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={() => onLocate(place)}><MapPin size={14} aria-hidden />{t('map')}</button>
              {href && <a className={primary} href={href} target="_blank" rel="noopener noreferrer">{t('navigation')}<ArrowUpRight size={14} aria-hidden /></a>}
            </div>
          </li>;
        })}</ul>
      </div>
    </dialog>
  );
}
