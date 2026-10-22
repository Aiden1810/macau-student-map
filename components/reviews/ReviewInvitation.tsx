'use client';

import Link from 'next/link';
import {MessageCirclePlus} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';

export default function ReviewInvitation({placeId}: {placeId: string}) {
  const locale = useLocale();
  const t = useTranslations('ShopDetail');
  return (
    <div className="rounded-2xl bg-pine-50/70 px-4 py-5 text-sm">
      <p className="leading-6 text-muted">{t('emptyReviews')}</p>
      <Link href={`/${locale}/shop/${placeId}/review/new`} onClick={event => event.stopPropagation()}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-pine-700 px-4 py-2 font-medium text-white hover:bg-pine-800 focus-visible:ring-2 focus-visible:ring-pine-700 focus-visible:ring-offset-2">
        <MessageCirclePlus size={17} aria-hidden="true" />{t('writeFirstReview')}
      </Link>
    </div>
  );
}
