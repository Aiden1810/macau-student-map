'use client';

import Link from 'next/link';
import {Heart, MapPin, Star} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import PlaceCover from './PlaceCover';
import {formatPlacePrice, getPlacePresentation} from '@/lib/domain/place-types';
import {resolveTagAlias} from '@/lib/domain/taxonomy';
import type {Shop} from '@/types/shop';

export default function MobilePlaceCard({shop, favorite, onFavorite, onLocate, highlighted}: {
  shop: Shop; favorite: boolean; onFavorite?: (id: string, event: React.MouseEvent) => void;
  onLocate: (id: string) => void; highlighted: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('ShopDetail');
  const home = useTranslations('Home');
  const map = useTranslations('Map');
  const branch = /^(.*?)\s*[（(]([^（）()]+)[）)]$/.exec(shop.name);
  const label = getPlacePresentation(shop).label;
  const cuisineTags = shop.tags.filter(value => resolveTagAlias(value).some(tag => tag.kind === 'cuisine'));
  const hasRating = shop.reviews > 0 && Number.isFinite(shop.rating) && shop.rating > 0;
  return (
    <article className={`flex items-start gap-1 rounded-[20px] border bg-white p-3 transition ${highlighted ? 'border-pine-600 ring-2 ring-pine-100' : 'border-line'}`}>
      <Link href={`/${locale}/shop/${shop.id}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700">
        <div className="mt-0.5 h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl"><PlaceCover src={shop.imageUrls?.[0]} name={shop.name} size={76} /></div>
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-[1.45] text-ink">{branch ? branch[1] : shop.name}</h3>
          {branch && <p className="line-clamp-1 text-[13px] leading-5 text-muted">({branch[2]})</p>}
          <p className="mt-1 text-xs leading-5 text-muted">{label}{shop.region ? ` · ${shop.region}` : ''}</p>
          {cuisineTags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{cuisineTags.map(tag => (
            <span key={tag} className="rounded-md bg-pine-50 px-1.5 py-0.5 text-[11px] leading-4 text-pine-800">{tag}</span>
          ))}</div>}
          <p className="mt-0.5 text-[13px] font-medium leading-5 text-ink">{formatPlacePrice(shop)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            {hasRating ? <><Star size={12} className="fill-[#ae8641] text-[#ae8641]" aria-hidden="true" />{shop.rating.toFixed(1)} · {t('reviewsCount', {count: shop.reviews})}</> : map('noReviews')}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-1">
        {onFavorite && <button type="button" aria-label={favorite ? home('mobile.favorited') : home('mobile.favorite')} aria-pressed={favorite} onClick={event => onFavorite(shop.id, event)}
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-pine-700 ${favorite ? 'border-pine-100 bg-pine-50 text-pine-700' : 'border-line text-muted hover:bg-canvas'}`}><Heart size={19} className={favorite ? 'fill-current' : ''} aria-hidden="true" /></button>}
        <button type="button" aria-label={t('viewLocation')} title={t('viewLocation')} onClick={() => onLocate(shop.id)} disabled={!shop.hasCoordinates}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-pine-700 transition hover:bg-pine-50 focus-visible:ring-2 focus-visible:ring-pine-700 disabled:text-slate-300"><MapPin size={19} aria-hidden="true" /></button>
      </div>
    </article>
  );
}
