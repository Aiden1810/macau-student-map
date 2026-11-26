'use client';

import {useEffect, useState} from 'react';
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  Globe,
  Heart,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Star,
  UserRound
} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {useSharedFavorites} from '@/lib/favorites/FavoritesProvider';
import {mealHistoryEnabled} from '@/lib/meal-history/model';
import {contactCopy} from '@/lib/contact/copy';

type Account = {id: string; email?: string};
type Review = {id: string; place_id: string; rating: number; moderation_status: string};
const panel = 'rounded-[22px] border border-line bg-white p-4 shadow-[0_2px_10px_rgba(25,61,50,0.04)] sm:p-5';
const rowLink = 'inline-flex min-h-10 min-w-0 items-center gap-1.5 text-sm font-semibold text-ink transition hover:text-pine-800';
const pillAction = 'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 text-xs font-semibold text-pine-800 transition hover:border-pine-200 hover:bg-pine-50';
const languages = [['zh-CN', '简体中文'], ['zh-MO', '繁體中文'], ['en', 'English']] as const;

function PersonalData({account}: {account: Account | null}) {
  const t = useTranslations('MainNavigation');
  const {favorites, isLoaded, toggleFavorite} = useSharedFavorites();
  const [catalog, setCatalog] = useState<{id: string; name: string}[] | 'error' | null>(null);
  const [reviews, setReviews] = useState<Review[] | 'error' | null>(null);
  const [reviewCount, setReviewCount] = useState(10);
  const placeIds = [...new Set([...favorites, ...(Array.isArray(reviews) ? reviews.map(review => review.place_id) : [])])].join(',');

  useEffect(() => {
    if (!placeIds) return;
    const controller = new AbortController();
    const ids = placeIds.split(',');
    const chunks = Array.from({length: Math.ceil(ids.length / 50)}, (_, index) => ids.slice(index * 50, (index + 1) * 50));
    void Promise.all(chunks.map(chunk => supabase.from('places').select('id,name')
      .eq('status', 'published').in('id', chunk).abortSignal(controller.signal)))
      .then(results => {
        if (!controller.signal.aborted) setCatalog(results.some(result => result.error)
          ? 'error' : results.flatMap(result => result.data ?? []));
      }).catch(() => {if (!controller.signal.aborted) setCatalog('error');});
    return () => controller.abort();
  }, [placeIds]);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const {data, error} = await supabase.from('reviews').select('id,place_id,rating,moderation_status')
          .eq('user_id', account.id).is('deleted_at', null).order('updated_at', {ascending: false})
          .order('id').limit(reviewCount + 1).abortSignal(controller.signal);
        if (!controller.signal.aborted) setReviews(error ? 'error' : (data ?? []) as Review[]);
      } catch {
        if (!controller.signal.aborted) setReviews('error');
      }
    })();
    return () => controller.abort();
  }, [account, reviewCount]);

  const places = new Map(Array.isArray(catalog) ? catalog.map(place => [place.id, place.name]) : []);
  return (
    <>
      <section className={panel} aria-labelledby="me-favorites">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink" id="me-favorites">
            <Heart size={17} aria-hidden className="text-pine-700" />
            {t('favorites')}
          </h2>
          {isLoaded && favorites.length > 0 && (
            <span className="rounded-full bg-pine-50 px-2.5 py-0.5 text-xs font-semibold text-pine-800">{favorites.length}</span>
          )}
        </div>
        {!isLoaded || (favorites.length > 0 && catalog === null) ? (
          <p role="status" className="text-sm text-muted">{t('loading')}</p>
        ) : favorites.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-center text-sm text-muted">{t('emptyFavorites')}</p>
        ) : catalog === 'error' ? (
          <p role="status" className="text-sm text-rose-700">{t('loadError')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {favorites.map(id => (
              <li key={id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                {places.has(id) ? (
                  <Link className={`${rowLink} truncate`} href={`/shop/${id}`}>
                    <span className="truncate">{places.get(id)}</span>
                    <ArrowUpRight size={14} aria-hidden className="shrink-0 text-pine-700" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted">{t('unavailablePlace')}</span>
                )}
                <button className={`${pillAction} shrink-0`} type="button" onClick={() => void toggleFavorite(id)}>
                  {t('removeFavorite')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {account && (
        <section className={panel} aria-labelledby="me-reviews">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink" id="me-reviews">
              <MessageSquareText size={17} aria-hidden className="text-pine-700" />
              {t('reviews')}
            </h2>
          </div>
          {reviews === null ? (
            <p role="status" className="text-sm text-muted">{t('loading')}</p>
          ) : reviews === 'error' ? (
            <p role="status" className="text-sm text-rose-700">{t('loadError')}</p>
          ) : reviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-center text-sm text-muted">{t('emptyReviews')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {reviews.slice(0, reviewCount).map(review => (
                <li key={review.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 text-sm">
                  {places.has(review.place_id) ? (
                    <Link className={rowLink} href={`/shop/${review.place_id}/review/new`}>
                      <span>{places.get(review.place_id)}</span>
                      <ArrowUpRight size={14} aria-hidden className="shrink-0 text-pine-700" />
                    </Link>
                  ) : (
                    <span className="text-muted">{t('unavailablePlace')}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#fdf6e2] px-2 py-0.5 text-xs font-semibold text-[#7a5410]">
                      <Star size={11} aria-hidden className="fill-[#d4a24c] text-[#d4a24c]" />
                      {t('rating', {rating: review.rating})}
                    </span>
                    {review.moderation_status === 'pending' && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{t('pendingReview')}</span>
                    )}
                    {review.moderation_status === 'rejected' && (
                      <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{t('rejectedReview')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {Array.isArray(reviews) && reviews.length > reviewCount && (
            <button type="button" className={`${pillAction} mt-3`} onClick={() => setReviewCount(count => count + 10)}>
              {t('moreReviews')}
            </button>
          )}
        </section>
      )}
    </>
  );
}

export default function PersonalCenter() {
  const t = useTranslations('MainNavigation');
  const auth = useTranslations('Auth');
  const contribute = useTranslations('Contribute');
  const meal = useTranslations('MealHistory');
  const locale = useLocale();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [signOutError, setSignOutError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => setAccount(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const {error} = await supabase.auth.signOut();
      setSignOutError(Boolean(error));
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main id="my-page" className="mx-auto grid max-w-3xl gap-4 px-4 pb-28 pt-5 sm:px-8">
      <section className="rounded-[24px] bg-gradient-to-br from-pine-900 to-pine-800 p-5 text-white shadow-[0_12px_32px_rgba(16,42,29,0.16)] sm:p-6" aria-labelledby="me-account">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
              <UserRound size={22} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{t('me')}</h1>
              <p id="me-account" className="mt-0.5 truncate text-sm text-pine-100">
                {account === undefined ? t('loading') : account ? (account.email ?? t('signedIn')) : t('account')}
              </p>
            </div>
          </div>
          {account === null && (
            <Link
              className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-semibold text-pine-900 shadow-sm transition hover:bg-pine-50"
              href={{pathname: '/login', query: {next: `/${locale}/me`}}}
            >
              {t('signIn')}
            </Link>
          )}
        </div>
        {account && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/15 pt-4">
            <Link className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/12 px-3.5 text-sm font-medium text-white transition hover:bg-white/20" href="/my-submissions">
              <FileText size={15} aria-hidden />
              {contribute('mySubmissions')}
            </Link>
            {mealHistoryEnabled && (
              <Link className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/12 px-3.5 text-sm font-medium text-white transition hover:bg-white/20" href="/meal-history">
                <BookOpen size={15} aria-hidden />
                {meal('title')}
              </Link>
            )}
            <button
              type="button"
              className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut size={15} aria-hidden />
              {auth('logout')}
            </button>
          </div>
        )}
        {signOutError && <p role="alert" className="mt-3 rounded-xl bg-rose-500/20 px-3 py-2 text-xs text-rose-100">{t('signOutError')}</p>}
      </section>
      {account !== undefined && <PersonalData key={account?.id ?? 'guest'} account={account} />}
      <section className={panel} aria-labelledby="me-settings">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink" id="me-settings">
          <Globe size={17} aria-hidden className="text-pine-700" />
          {t('settings')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {languages.map(([code, name]) => (
            <Link
              key={code}
              href="/me"
              locale={code}
              aria-current={locale === code ? 'true' : undefined}
              className="inline-flex min-h-10 items-center rounded-xl border border-line bg-canvas px-4 text-sm font-semibold text-muted transition hover:border-pine-200 hover:text-pine-800 aria-[current=true]:border-pine-800 aria-[current=true]:bg-pine-800 aria-[current=true]:text-white aria-[current=true]:shadow-sm"
            >
              {name}
            </Link>
          ))}
        </div>
        <div className="mt-4 border-t border-stone-100 pt-3">
          <Link className={pillAction} href="/contact">
            <MessageCircle size={15} aria-hidden />
            {contactCopy(locale).title}
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
