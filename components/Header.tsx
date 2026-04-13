import {ChevronDown, Globe, LogOut, Menu, Search, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {type CSSProperties, useEffect, useRef, useState} from 'react';
import {Link, usePathname} from '@/i18n/navigation';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchPlaceholder: string;
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
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!desktopMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!desktopMenuRef.current) return;
      if (!desktopMenuRef.current.contains(event.target as Node)) {
        setDesktopMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [desktopMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  const handleDesktopMenuAction = (action: () => void) => {
    action();
    setDesktopMenuOpen(false);
  };

  return (
    <header className={`pointer-events-auto z-50 md:sticky md:top-0 md:border-b md:border-slate-200 md:text-slate-800 md:shadow-sm md:transition-all md:duration-300 md:ease-[cubic-bezier(0.4,0,0.2,1)] ${isCompact ? 'md:bg-white/95' : 'md:bg-white'}`}>
      <div className="mx-auto flex max-w-[1380px] items-center gap-3 px-3 py-2 sm:px-6 md:px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2" style={GLASS_STYLE}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#FFCC00]/60 bg-[#0c4b2f] text-white shadow-md shadow-[#003a24]/35">
            <span className="text-xs font-extrabold tracking-wide">M</span>
          </div>
          <h1 className="truncate text-sm font-bold text-[#0d2918] sm:text-base md:text-lg md:text-[#0c4b2f]">Lumen Map</h1>
        </div>

        <div className="relative hidden min-w-0 flex-1 items-center md:flex">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-[#006633] focus:ring-2 focus:ring-[#006633]/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div ref={mobileMenuRef} className="relative flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-2xl border border-[#1A5C2E]/25 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1A5C2E] transition hover:bg-[#1A5C2E]/5"
              aria-expanded={mobileMenuOpen}
              aria-label={tCommon('mine')}
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

          <div ref={desktopMenuRef} className="relative hidden items-center md:flex">
            <button
              type="button"
              onClick={() => setDesktopMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-2xl border border-[#1A5C2E]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#1A5C2E] transition hover:bg-[#1A5C2E]/5 sm:text-sm"
              aria-expanded={desktopMenuOpen}
              aria-label={tCommon('mine')}
            >
              <span>{tCommon('mine')}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {desktopMenuOpen && (
              <div className="absolute right-0 top-full z-[90] mt-2 w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => handleDesktopMenuAction(onToggleContribute)}
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {contributeLabel}
                </button>

                <Link
                  href={mySubmissionsHref}
                  className="block px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setDesktopMenuOpen(false)}
                >
                  {mySubmissionsLabel}
                </Link>

                <div className="border-y border-slate-100 px-3 py-2">
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{tCommon('language')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGE_OPTIONS.map((item) => (
                      <Link
                        key={item.key}
                        href={pathname}
                        locale={item.key}
                        className={`rounded-full px-2 py-1 text-xs transition ${locale === item.key ? 'bg-[#006633]/10 text-[#006633] font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setDesktopMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {userEmail ? (
                  <button
                    type="button"
                    onClick={() => handleDesktopMenuAction(onLogout)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <span>{tAuth('logout')}</span>
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="block px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setDesktopMenuOpen(false)}
                  >
                    {tAuth('notLoggedIn')}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
