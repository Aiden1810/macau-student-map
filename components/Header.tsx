import {List, LogIn, LogOut, Map as MapIcon, Search, ShieldCheck} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {Link} from '@/i18n/navigation';
import {ViewMode} from '@/types/shop';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  title: string;
  searchPlaceholder: string;
  isAdmin: boolean;
  userEmail: string | null;
  loginHref: string;
  onLogout: () => void;
}

export default function Header({
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  title,
  searchPlaceholder,
  isAdmin,
  userEmail,
  loginHref,
  onLogout
}: HeaderProps) {
  const tAuth = useTranslations('Auth');
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-emerald-900/20 text-white shadow-sm backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isCompact ? 'bg-[#006633]/86' : 'bg-[#006633]/96'
      }`}
    >
      <div
        className={`relative mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isCompact ? 'h-12' : 'h-16'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FFCC00]/70 to-transparent" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FFCC00]/60 bg-[#0c4b2f] text-white shadow-md shadow-[#003a24]/35">
            <span className="text-xs font-extrabold tracking-wide">MU</span>
          </div>
          <h1 className="text-xl font-bold text-[#9FE870] drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
            Macau Lens
          </h1>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden md:block">
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

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {userEmail ? (
            <div className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white sm:flex">
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
          ) : (
            <Link
              href={loginHref}
              className="hidden items-center gap-1 rounded-full border border-[#FFCC00]/80 bg-[#FFCC00] px-3 py-1.5 text-xs font-semibold text-[#0f3d26] transition hover:brightness-95 sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" />
              {tAuth('login')}
            </Link>
          )}

          <div className="flex md:hidden bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'map' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
