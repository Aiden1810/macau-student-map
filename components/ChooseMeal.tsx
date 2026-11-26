'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowUpRight, Dices, Footprints, Heart, Sparkles} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import ChatOriginPicker from '@/components/assistant/ChatOriginPicker';
import MealDecision from '@/components/MealDecision';
import type {Shop} from '@/types/shop';
import {useSharedFavorites} from '@/lib/favorites/FavoritesProvider';
import {chatCopy} from '@/lib/assistant/chat-copy';
import {assistantIntentSchema, originSchema, type AssistantOrigin, type RouteSnapshot} from '@/lib/assistant/contracts';
import type {AmapPoiOption} from '@/lib/amap/place-search';
import {locateAssistantOrigin} from '@/lib/amap/assistant-location';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import {buildRouteNavigationUrl, compareAmapRoutes} from '@/lib/amap/route-comparison';
import {chooseMealCandidate} from '@/lib/meal-decision/draw';
import {finishMealChoice, prepareMealChoice, toMealCatalog} from '@/lib/meal-decision/choose';

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50';
const mapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY ?? '';
const optionalNumber = (value: string) => value.trim() ? Number(value) : null;
type Result = ReturnType<typeof finishMealChoice> & {origin: AssistantOrigin | null; routeFailure: boolean};
type ChoiceError = 'invalid' | 'needPeople' | 'needOrigin' | 'locationFailed' | 'catalogFailed';

export default function ChooseMeal() {
  const t = useTranslations('ChooseMeal');
  const tDecision = useTranslations('MealDecision');
  const tHome = useTranslations('Home');
  const locale = useLocale();
  const {favorites, toggleFavorite, isLoaded: favoritesLoaded} = useSharedFavorites();
  const [people, setPeople] = useState('');
  const [budgetType, setBudgetType] = useState<'per' | 'total'>('per');
  const [budget, setBudget] = useState('');
  const [food, setFood] = useState('');
  const [walking, setWalking] = useState('');
  const [origin, setOrigin] = useState<AssistantOrigin | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<ChoiceError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [catalogShops, setCatalogShops] = useState<Shop[]>([]);
  const [comparisonShops, setComparisonShops] = useState<Shop[]>([]);
  const running = useRef(false);
  const copy = chatCopy(locale);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/places', {cache: 'no-store'}).then(response => response.json()).then(body => {
      if (cancelled || body?.ok !== true || !Array.isArray(body.data?.items)) return;
      setCatalogShops(body.data.items as Shop[]);
    }).catch(() => {});
    return () => {cancelled = true;};
  }, []);

  function resetResults() {
    setResult(null);
    setError(null);
    setDrawnId(null);
    setComparisonShops([]);
  }

  function selectOrigin(place: AmapPoiOption) {
    const parsed = originSchema.safeParse({
      coordinates: place.coordinates, label: place.name,
      city: place.city === 'macau' ? '澳门' : place.city === 'zhuhai' ? '珠海' : null
    });
    if (!parsed.success) {
      setError('locationFailed');
      return;
    }
    setOrigin(parsed.data);
    resetResults();
  }

  async function locate() {
    if (busy || locating) return;
    setLocating(true);
    resetResults();
    try {
      const found = await locateAssistantOrigin(mapKey, copy.currentLocation);
      setOrigin(originSchema.parse(found));
    } catch {
      setError('locationFailed');
    } finally {
      setLocating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || locating) return;
    resetResults();
    const amount = optionalNumber(budget);
    const parsed = assistantIntentSchema.safeParse({
      intent: 'recommend', budgetPerPerson: budgetType === 'per' ? amount : null,
      totalBudget: budgetType === 'total' ? amount : null, currency: 'CNY',
      partySize: optionalNumber(people), foods: food.trim() ? [food.trim()] : [],
      excludedFoods: [], priority: 'balanced', transport: 'walking', maxWalkingMinutes: optionalNumber(walking)
    });
    if (!parsed.success) return setError('invalid');
    const intent = parsed.data;
    if (intent.totalBudget !== null && intent.partySize === null) return setError('needPeople');
    const start = intent.maxWalkingMinutes == null ? null : origin;
    if (intent.maxWalkingMinutes != null && !start) return setError('needOrigin');

    running.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/places', {cache: 'no-store'});
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body.data?.canonicalAvailable === false ||
          !Array.isArray(body.data?.items)) throw new Error('Published places unavailable');
      const prepared = prepareMealChoice(toMealCatalog(body.data.items), intent, start);
      let routes: RouteSnapshot[] = [];
      let routeFailure = false;
      if (start && prepared.candidates.length) {
        try {
          routes = await compareAmapRoutes(mapKey, start, prepared.candidates.map(place => ({
            id: place.id, coordinates: place.coordinates, city: null
          })), 'walking');
        } catch {
          routeFailure = true;
        }
      }
      const comparison = finishMealChoice(prepared, intent, routes);
      const foundIds = new Set(comparison.matches.map(row => row.place.id));
      setComparisonShops((body.data.items as Shop[]).filter(shop => foundIds.has(shop.id)));
      setResult({...comparison, origin: start, routeFailure});
    } catch {
      setError('catalogFailed');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const selectedId = drawnId ?? result?.recommendedPlaceId;
  const resultRows = result?.matches ?? [];
  const exclusionReasons = ['over_budget', 'over_walking', 'unknown_price', 'unknown_walking', 'food_mismatch', 'not_dining'] as const;
  const exclusions = exclusionReasons.flatMap(reason => result?.excluded[reason] ? [{reason, count: result.excluded[reason]!}] : []);
  const number = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});

  return (
    <main id="choose-page" className="min-h-screen bg-[#f5f7f1] px-4 pb-24 pt-4 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pine-800">
          <ArrowLeft size={16} aria-hidden />{t('back')}
        </Link>
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-[24px] bg-gradient-to-br from-pine-900 to-pine-800 px-5 py-6 text-white shadow-[0_12px_32px_rgba(16,42,29,0.16)] sm:px-8 sm:py-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-pine-100">{t('intro')}</p>
          </div>
          <button type="button" id="choose-random-meal" aria-haspopup="dialog" aria-controls="choose-meal-decision"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-pine-900 shadow-sm transition hover:bg-pine-50 active:scale-[0.98]"
            onClick={() => setDecisionOpen(true)}>
            <Dices size={17} aria-hidden className="text-pine-700" />
            {tDecision('title')}
          </button>
        </header>
        <MealDecision dialogId="choose-meal-decision" open={decisionOpen}
          matchingPlaces={comparisonShops.length > 0 ? comparisonShops : catalogShops}
          catalogLoading={busy}
          onClose={() => setDecisionOpen(false)} />
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section aria-labelledby="meal-filters" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <h2 id="meal-filters" className="text-lg font-semibold">{t('conditions')}</h2>
            <form onSubmit={(event) => void submit(event)} className="mt-3">
              <fieldset disabled={busy || locating} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="min-w-0 text-sm font-medium">{t('people')}
                    <input type="number" inputMode="numeric" min="1" max="100" className={fieldClass} value={people}
                      onChange={event => {setPeople(event.target.value); resetResults();}} />
                  </label>
                  <label className="min-w-0 text-sm font-medium">{t('budgetType')}
                    <select className={fieldClass} value={budgetType}
                      onChange={event => {setBudgetType(event.target.value === 'total' ? 'total' : 'per'); resetResults();}}>
                      <option value="per">{t('perPerson')}</option>
                      <option value="total">{t('total')}</option>
                    </select>
                  </label>
                  <label className="min-w-0 text-sm font-medium">{t('budget')}
                    <input type="number" inputMode="decimal" min="0" max={budgetType === 'per' ? 100000 : 1000000} step="0.01"
                      value={budget} className={fieldClass} onChange={event => {setBudget(event.target.value); resetResults();}} />
                  </label>
                  <label className="min-w-0 text-sm font-medium">{t('walking')}
                    <input type="number" inputMode="numeric" min="1" max="2880" value={walking} className={fieldClass}
                      onChange={event => {setWalking(event.target.value); resetResults();}} />
                  </label>
                </div>
                <label className="block text-sm font-medium">{t('food')}
                  <input maxLength={30} value={food} className={fieldClass} placeholder={t('foodExample')}
                    onChange={event => {setFood(event.target.value); resetResults();}} />
                </label>
                {walking !== '' && (
                  <div className="rounded-xl border border-pine-100 bg-pine-50 px-3 py-2">
                    <p className="flex items-center gap-2 text-sm font-medium text-pine-900"><Footprints size={16} aria-hidden />{t('origin')}</p>
                    {origin ? <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words text-sm">{origin.label}</span>
                      <button type="button" className="min-h-9 text-sm text-pine-800 underline"
                        onClick={() => {setOrigin(null); resetResults();}}>{t('changeOrigin')}</button>
                    </div> : <ChatOriginPicker copy={copy} busy={locating} onSelect={selectOrigin} onLocate={() => void locate()} />}
                  </div>
                )}
                <button type="submit" className={`${buttonClass} w-full bg-pine-800 text-white hover:bg-pine-900`}>{t(busy ? 'searching' : 'search')}</button>
              </fieldset>
              {error && <p role="alert" className="mt-3 text-sm text-rose-700">{t(error)}</p>}
            </form>
          </section>
          <section aria-labelledby="meal-results" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="meal-results" className="text-lg font-semibold">{t('results')}</h2>
              {resultRows.length > 1 && <button type="button" className={`${buttonClass} border border-line text-pine-800 hover:bg-pine-50`}
                onClick={() => setDrawnId(chooseMealCandidate(resultRows.map(({place}) => ({id: place.id, name: place.name})))?.id ?? null)}>
                <Dices size={16} aria-hidden />{t('draw')}
              </button>}
            </div>
            <p role="status" className="mt-2 text-sm text-muted">
              {busy ? t('searching') : !result ? t('initial') : resultRows.length ? t('count', {count: resultRows.length}) : t('none')}
              {drawnId && ` · ${t('drawResult', {name: resultRows.find(row => row.place.id === drawnId)?.place.name ?? ''})}`}
            </p>
            {result && result.remaining > 0 && <p className="mt-2 text-xs leading-5 text-muted">
              {t(result.origin ? 'unchecked' : 'more', {count: result.remaining})}
            </p>}
            {(result?.routeFailure || result?.walkingRequestFailed) && <p className="mt-2 text-sm text-amber-800">{t('routeFailure')}</p>}
            {exclusions.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">
              {exclusions.map(({reason, count}) => <li key={reason} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-muted">
                {t(reason, {count})}
              </li>)}
            </ul>}
            {resultRows.length > 0 && <ul className="mt-4 space-y-3">
              {resultRows.map(({place, groupTotal, route}) => {
                const walked = route?.walking?.status === 'ok' ? route.walking.durationSeconds : null;
                const isFavorited = favorites.includes(place.id);
                const navigation = !place.coordinates ? null
                  : result?.origin ? buildRouteNavigationUrl(result.origin.coordinates, place.coordinates, place.name, 'walking')
                    : buildAmapNavigationUrl({...place, coordinates: place.coordinates, hasCoordinates: true});
                return <li key={place.id} className={`rounded-[20px] border p-4 transition ${selectedId === place.id ? 'border-pine-300 bg-gradient-to-br from-pine-50/90 to-[#faf6ea] shadow-sm' : 'border-line bg-white'}`}>
                  {selectedId === place.id && (
                    <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-pine-800 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      <Sparkles size={11} aria-hidden className="text-[#f2d07b]" />
                      {t(drawnId ? 'chosen' : 'recommended')}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-ink">{place.name}</h3>
                      {place.address && <p className="mt-1 break-words text-xs text-muted">{place.address}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={!favoritesLoaded}
                      aria-pressed={isFavorited}
                      aria-label={isFavorited ? tHome('mobile.favorited') : tHome('mobile.favorite')}
                      onClick={() => void toggleFavorite(place.id)}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                        isFavorited ? 'border-pine-200 bg-pine-50 text-pine-700' : 'border-line bg-white text-muted hover:bg-canvas'
                      }`}
                    >
                      <Heart size={18} aria-hidden className={isFavorited ? 'fill-current' : ''} />
                    </button>
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                    <div><dt className="text-xs text-muted">{t('priceLabel')}</dt><dd className="font-semibold text-ink">{place.pricePerPerson === null ? t('unknown') : `¥${number.format(place.pricePerPerson)}`}</dd></div>
                    {groupTotal !== null && <div><dt className="text-xs text-muted">{t('totalLabel')}</dt><dd className="font-semibold text-ink">¥{number.format(groupTotal)}</dd></div>}
                    {walked !== null && <div><dt className="text-xs text-muted">{t('walkLabel')}</dt><dd className="font-semibold text-pine-800">{t('minutes', {count: Math.ceil(walked / 60)})}</dd></div>}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-2.5 text-xs font-semibold">
                    <Link href={`/shop/${place.id}`} className="inline-flex min-h-9 items-center rounded-xl border border-pine-200 bg-white px-3 text-pine-800 transition hover:bg-pine-50">
                      {t('details')}
                    </Link>
                    {navigation && <a href={navigation} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-pine-800 px-3 text-white transition hover:bg-pine-900">
                      {t('navigate')} <ArrowUpRight size={13} aria-hidden />
                    </a>}
                  </div>
                </li>;
              })}
            </ul>}
          </section>
        </div>
      </div>
    </main>
  );
}
