import {ChevronDown, Globe, LogOut, MessageCircle, Search, UserRound, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {type CSSProperties, useEffect, useRef, useState} from 'react';
import {Link, usePathname} from '@/i18n/navigation';
import {assistantCopy} from '@/lib/assistant/copy';
import {contactCopy} from '@/lib/contact/copy';

interface HeaderProps {
  assistantOpen: boolean;
  onToggleAssistant: () => void;
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
  assistantOpen,
  onToggleAssistant,
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
  const tHome = useTranslations('Home');
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
    <header className={`pointer-events-auto z-50 pt-[max(env(safe-area-inset-top,0px),0px)] md:pt-0 md:sticky md:top-0 md:border-b md:border-slate-200 md:text-slate-800 md:shadow-sm md:transition-all md:duration-300 md:ease-[cubic-bezier(0.4,0,0.2,1)] ${isCompact ? 'md:bg-white/95' : 'md:bg-white'}`}>
      <div className="mx-auto flex max-w-[1380px] items-center gap-2 p-0 sm:px-0 md:gap-3 md:px-4 md:py-2 lg:px-8">
        <div className="hidden min-w-0 items-center gap-2 md:flex" style={GLASS_STYLE}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-700 text-white">
            <span className="text-xs font-extrabold tracking-wide">觅</span>
          </div>
          <h1 className="truncate text-sm font-bold text-[#0d2918] sm:text-base md:text-lg md:text-[#0c4b2f]">城觅 <span className="ml-1 text-xs font-normal text-muted">CityU Food</span></h1>
        </div>

        <div className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-full border border-line/60 bg-white px-3 shadow-[0_3px_16px_#193d3210] md:hidden">
          <span aria-label="城觅" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-700 text-lg font-semibold text-white">觅</span>
          <input type="search" aria-label={tHome('mobile.searchPlaceholder')} placeholder={tHome('mobile.searchPlaceholder')} value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder:text-muted outline-none" />
          <Search size={19} aria-hidden="true" className="shrink-0 text-muted" />
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={onToggleAssistant} aria-haspopup="dialog" aria-expanded={assistantOpen} aria-controls="home-ai-dialog" className="hidden min-h-10 items-center rounded-xl bg-pine-700 md:inline-flex px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm">
            {assistantCopy(locale).nav}
          </button>
          <div ref={mobileMenuRef} className="relative flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-line/60 bg-white text-ink shadow-[0_3px_16px_#193d3210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700"
              aria-expanded={mobileMenuOpen}
              aria-label={tCommon('mine')}
            >
              {mobileMenuOpen ? <X size={22} /> : <UserRound size={22} />}
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

                <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageCircle size={16} />{contactCopy(locale).title}</Link>

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

                <Link href="/contact" onClick={() => setDesktopMenuOpen(false)} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageCircle size={16} />{contactCopy(locale).title}</Link>

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
