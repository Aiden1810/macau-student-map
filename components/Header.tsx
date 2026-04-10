import {ChevronDown, Globe, LogOut, Menu, Search, ShieldCheck, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {type CSSProperties, useEffect, useRef, useState} from 'react';
import {Link, usePathname} from '@/i18n/navigation';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchPlaceholder: string;
  isAdmin: boolean;
  userEmail: string | null;
  loginHref: string;
  mySubmissionsHref: string;
  onLogout: () => void;
  onToggleContribute: () => void;
  contributeLabel: string;
  mySubmissionsLabel: string;
}

const GLASS_STYLE: CSSProperties = {
  background: 'transparent',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  border: 'none',
  boxShadow: 'none'
};

const LANGUAGE_OPTIONS = [
  {key: 'zh-CN', label: '简体中文'},
  {key: 'zh-MO', label: '繁體中文'},
  {key: 'en', label: 'English'}
] as const;

export default function Header({
  searchQuery,
  setSearchQuery,
  searchPlaceholder,
  isAdmin,
  userEmail,
  loginHref,
  mySubmissionsHref,
  onLogout,
  onToggleContribute,
  contributeLabel,
  mySubmissionsLabel
}: HeaderProps) {
  const tCommon = useTranslations('Common');
  const tAuth = useTranslations('Auth');
  const locale = useLocale();
  const pathname = usePathname();
  const [isCompact, setIsCompact] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileMenuRef.current) return;
      if (!mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [mobileMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <header className={`pointer-events-auto z-50 md:sticky md:top-0 md:border-b md:border-emerald-900/20 md:text-white md:shadow-sm md:backdrop-blur-md md:transition-all md:duration-300 md:ease-[cubic-bezier(0.4,0,0.2,1)] ${isCompact ? 'md:bg-[#006633]/88' : 'md:bg-[#006633]/95'}`}>
      <div className="mx-auto flex max-w-[1380px] flex-col md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-1 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between gap-2 px-0 py-0.5 md:bg-transparent md:px-0 md:py-0" style={GLASS_STYLE}>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#FFCC00]/60 bg-[#0c4b2f] text-white shadow-md shadow-[#003a24]/35">
              <span className="text-xs font-extrabold tracking-wide">M</span>
            </div>
            <h1 className="truncate text-base font-bold text-[#0d2918] md:text-xl md:text-[#0c4b2f]">Lumen Map</h1>
          </div>

          <div ref={mobileMenuRef} className="relative flex shrink-0 items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-2xl border border-[#1A5C2E]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#1A5C2E] transition hover:bg-[#1A5C2E]/5"
              aria-expanded={mobileMenuOpen}
              aria-label={tCommon('title')}
            >
              <span>{tCommon('mine')}</span>
              {mobileMenuOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </button>

            {mobileMenuOpen && (
              <div className="absolute right-0 top-full z-[90] mt-2 w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => handleMenuAction(onToggleContribute)}
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {contributeLabel}
                </button>

                <Link
                  href={mySubmissionsHref}
                  className="block px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {mySubmissionsLabel}
                </Link>

                <div className="border-y border-slate-100 px-3 py-2">
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{tCommon('language')}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGE_OPTIONS.map((item) => (
                      <Link
                        key={item.key}
                        href={pathname}
                        locale={item.key}
                        className={`rounded-full px-2 py-1 text-xs transition ${locale === item.key ? 'bg-[#006633]/10 text-[#006633] font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {userEmail ? (
                  <button
                    type="button"
                    onClick={() => handleMenuAction(onLogout)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <span>{tAuth('logout')}</span>
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="block px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {tAuth('notLoggedIn')}
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <div className="relative group">
              <button
                type="button"
                aria-label="Switch language"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/92 text-[#1A5C2E] shadow-sm shadow-emerald-900/10 transition hover:bg-white hover:shadow-md hover:shadow-emerald-900/15"
              >
                <Globe className="h-[17px] w-[17px] stroke-[2.2]" />
              </button>
              <div className="invisible absolute right-0 z-50 mt-1 min-w-[120px] rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100">
                {LANGUAGE_OPTIONS.map((item) => (
                  <Link
                    key={item.key}
                    href={pathname}
                    locale={item.key}
                    className={`block rounded-md px-2 py-1 text-xs ${locale === item.key ? 'bg-[#006633]/10 text-[#006633] font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleContribute}
              className="inline-flex items-center rounded-2xl bg-[#1A5C2E] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 sm:text-sm"
            >
              {contributeLabel}
            </button>
            <Link
              href={mySubmissionsHref}
              className="inline-flex items-center rounded-2xl border border-[#1A5C2E]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#1A5C2E] transition hover:bg-[#1A5C2E]/5 sm:text-sm"
            >
              {mySubmissionsLabel}
            </Link>
            {!userEmail && (
              <Link
                href={loginHref}
                className="inline-flex items-center rounded-2xl border border-[#1A5C2E]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#1A5C2E] transition hover:bg-[#1A5C2E]/5 sm:text-sm"
              >
                {tAuth('login')}
              </Link>
            )}
          </div>
        </div>

        <div className="hidden flex-1 max-w-md mx-4 md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-white/30 bg-white/15 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/70 outline-none transition-all focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={mySubmissionsHref}
            className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15"
          >
            {mySubmissionsLabel}
          </Link>

          {!userEmail && (
            <Link
              href={loginHref}
              className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15"
            >
              {tAuth('login')}
            </Link>
          )}

          {userEmail && (
            <div className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white md:flex">
              {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
              <span className="max-w-[140px] truncate">{userEmail}</span>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-white transition hover:bg-white/15"
              >
                <LogOut className="h-3.5 w-3.5" />
                {tAuth('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
