import {ArrowUpRight, MapPin, Navigation, Star} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import type {AmapPoiOption} from '@/lib/amap/place-search';

export default function AmapDiningCard({place, onLocate}: {place: AmapPoiOption; onLocate: (place: AmapPoiOption) => void}) {
  const t = useTranslations('LiveDiscovery');
  const format = useFormatter();
  const navigation = buildAmapNavigationUrl({...place, hasCoordinates: true});
  const branch = /^(.*?)\s*[（(]([^（）()]+)[）)]$/.exec(place.name);
  return (
    <article
      data-amap-dining-card
      className="rounded-[20px] border border-line bg-white p-3.5 shadow-[0_1px_2px_rgba(25,61,50,0.04)] transition-all duration-200 hover:border-pine-200 hover:shadow-[0_6px_18px_rgba(25,61,50,0.07)]"
    >
      <div className="min-w-0">
        <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-[1.4] text-ink">
          {branch?.[1] ? branch[1] : place.name}
        </h3>
        {branch?.[1] && (
          <p className="mt-0.5 line-clamp-1 text-xs leading-4 text-muted">({branch[2]})</p>
        )}
      </div>
      {place.fullAddress && (
        <p className="mt-1.5 flex items-start gap-1 text-xs leading-5 text-muted">
          <MapPin size={12} aria-hidden className="mt-1 shrink-0 text-pine-700/65" />
          <span className="line-clamp-2 break-words">{place.fullAddress}</span>
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium ${
          place.rating === undefined ? 'bg-stone-100 text-muted' : 'bg-[#fdf6e2] text-[#7a5410]'
        }`}>
          {place.rating !== undefined && <Star size={11} aria-hidden className="fill-[#d4a24c] text-[#d4a24c]" />}
          {place.rating === undefined ? t('noAmapScore') : t('amapScore', {score: format.number(place.rating)})}
        </span>
        {place.distanceMeters !== undefined && (
          <span className="inline-flex items-center rounded-lg bg-pine-50 px-2 py-0.5 font-medium text-pine-800">
            {t(place.distanceSource === 'user' ? 'yourDistance' : 'mapDistance', {meters: Math.round(place.distanceMeters)})}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2.5">
        <button
          type="button"
          onClick={() => onLocate(place)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-pine-200/80 bg-pine-50/70 px-3 text-xs font-semibold text-pine-800 transition hover:bg-pine-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700"
        >
          <MapPin size={13} aria-hidden />
          {t('map')}
        </button>
        {navigation && (
          <a
            href={navigation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-pine-800 px-3 text-xs font-semibold text-white transition hover:bg-pine-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 focus-visible:ring-offset-1"
          >
            <Navigation size={12} aria-hidden />
            {t('navigation')}
            <ArrowUpRight size={13} aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}
