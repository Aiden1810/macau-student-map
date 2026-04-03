'use client';

import {useLocale, useTranslations} from 'next-intl';
import {ChangeEvent} from 'react';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';

export default function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = event.target.value as (typeof routing.locales)[number];
    router.replace(pathname, {locale: nextLocale});
  };

  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span className="hidden sm:inline">{t('language')}</span>
      <select
        value={locale}
        onChange={onSelectChange}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
        aria-label={t('language')}
      >
        <option value="zh-CN">简体中文</option>
        <option value="zh-MO">繁體中文（澳門）</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
