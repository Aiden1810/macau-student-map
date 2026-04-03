import {List, LogIn, LogOut, Map as MapIcon, Search, ShieldCheck} from 'lucide-react';
import {useTranslations} from 'next-intl';
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
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            MU
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            {title}
          </h1>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-full text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {userEmail ? (
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 sm:flex">
              {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
              <span className="max-w-[140px] truncate">{userEmail}</span>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                {tAuth('logout')}
              </button>
            </div>
          ) : (
            <Link
              href={loginHref}
              className="hidden items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 sm:inline-flex"
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
