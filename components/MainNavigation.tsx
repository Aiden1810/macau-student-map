'use client';

import {Map, UserRound, Utensils} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {activeMainSection} from '@/lib/navigation/main-sections';

const tabs = [
  {key: 'discover', href: '/', Icon: Map},
  {key: 'choose', href: '/choose', Icon: Utensils},
  {key: 'me', href: '/me', Icon: UserRound}
] as const;

export default function MainNavigation({pathname}: {pathname: string}) {
  const t = useTranslations('MainNavigation');
  const activeSection = activeMainSection(pathname);
  return (
    <nav id="main-navigation" aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md shadow-[0_-4px_16px_rgba(25,61,50,0.06)] md:sticky md:top-0 md:bottom-auto md:border-b md:border-t-0 md:pb-0 md:shadow-[0_2px_10px_rgba(25,61,50,0.04)]">
      <div className="mx-auto grid h-[59px] max-w-[1380px] grid-cols-3 items-stretch gap-1 px-2 md:flex md:h-[var(--main-nav-top)] md:items-center md:justify-center md:gap-2 md:px-6">
        {tabs.map(({key, href, Icon}) => (
          <Link key={key} id={`main-nav-${key}`} href={href} scroll={key !== 'discover'}
            aria-current={key === activeSection ? 'page' : undefined}
            className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[11px] font-semibold leading-tight text-muted transition-colors hover:text-pine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine-700 aria-[current=page]:text-pine-800 md:min-h-10 md:flex-row md:gap-2 md:px-5 md:text-sm md:aria-[current=page]:bg-pine-100/90 md:aria-[current=page]:shadow-[inset_0_0_0_1px_rgba(27,94,60,0.12)]">
            <span className="flex h-7 w-11 items-center justify-center rounded-full transition-transform duration-200 group-aria-[current=page]:scale-105 group-aria-[current=page]:bg-pine-100 md:h-auto md:w-auto md:group-aria-[current=page]:scale-100 md:group-aria-[current=page]:bg-transparent">
              <Icon size={18} aria-hidden />
            </span>
            {t(key)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
