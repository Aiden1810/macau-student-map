'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowUpRight, Dices, Footprints, Heart, RefreshCw} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import ChatOriginPicker from '@/components/assistant/ChatOriginPicker';
import MealDecision from '@/components/MealDecision';
import MealExploration from '@/components/MealExploration';
import {chatCopy} from '@/lib/assistant/chat-copy';
import {assistantIntentSchema, originSchema, type AssistantOrigin, type RouteSnapshot} from '@/lib/assistant/contracts';
import type {AmapPoiOption} from '@/lib/amap/place-search';
import {locateAssistantOrigin} from '@/lib/amap/assistant-location';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import {buildRouteNavigationUrl, compareAmapRoutes} from '@/lib/amap/route-comparison';
import {useFavorites} from '@/lib/hooks/useFavorites';
import {chooseMealCandidate} from '@/lib/meal-decision/draw';
import {
  applyTastePreferencesToCatalog,
  finishMealChoice,
  nextCandidateId,
  prepareMealChoice,
  splitFoodTerms,
  toMealCatalog
} from '@/lib/meal-decision/choose';
import {mealHistoryEnabled, type MealEntry, type TastePreference} from '@/lib/meal-history/model';
import {readMeals, readPreferences} from '@/lib/meal-history/repository';
import {supabase} from '@/lib/supabase';
import type {Shop} from '@/types/shop';

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50';
const mapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY ?? '';
const optionalNumber = (value: string) => value.trim() ? Number(value) : null;
type Result = ReturnType<typeof finishMealChoice> & {origin: AssistantOrigin | null; routeFailure: boolean; avoidedByTaste: number};
type ChoiceError = 'invalid' | 'needPeople' | 'needOrigin' | 'locationFailed' | 'catalogFailed';

export default function ChooseMeal() {
  const t = useTranslations('ChooseMeal');
  const tDecision = useTranslations('MealDecision');
  const tHome = useTranslations('Home');
  const locale = useLocale();
  const {favorites, toggleFavorite, isLoaded: favoritesLoaded} = useFavorites();
  const [people, setPeople] = useState('');
  const [budgetType, setBudgetType] = useState<'per' | 'total'>('per');
  const [budget, setBudget] = useState('');
  const [food, setFood] = useState('');
  const [excludedFood, setExcludedFood] = useState('');
  const [priority, setPriority] = useState<'balanced' | 'cheapest' | 'fastest'>('balanced');
  const [walking, setWalking] = useState('');
  const [origin, setOrigin] = useState<AssistantOrigin | null>(null);
  const [useTasteProfile, setUseTasteProfile] = useState(true);
  const [savedMeals, setSavedMeals] = useState<MealEntry[]>([]);
  const [savedPreferences, setSavedPreferences] = useState<TastePreference[]>([]);
  const [catalogShops, setCatalogShops] = useState<Shop[]>([]);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<ChoiceError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const [pickedMode, setPickedMode] = useState<'draw' | 'swap' | null>(null);
  const running = useRef(false);
  const copy = chatCopy(locale);

  useEffect(() => {
    if (!mealHistoryEnabled) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({data}) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      return Promise.all([readMeals(userId, 0), readPreferences(userId)]).then(([history, prefs]) => {
        if (cancelled) return;
        setSavedMeals(history.items);
        setSavedPreferences(prefs);
      });
    }).catch(() => {});
    return () => {cancelled = true;};
  }, []);

  function resetResults() {
    setResult(null);
    setError(null);
    setDrawnId(null);
    setPickedMode(null);
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
      partySize: optionalNumber(people), foods: splitFoodTerms(food),
      excludedFoods: splitFoodTerms(excludedFood), priority, transport: 'walking', maxWalkingMinutes: optionalNumber(walking)
    });
    if (!parsed.success) return setError('invalid');
    const intent = parsed.data;
    if (intent.totalBudget !== null && intent.partySize === null) return setError('needPeople');
    const needRoute = intent.maxWalkingMinutes != null || intent.priority === 'fastest';
    const start = needRoute ? origin : null;
    if (needRoute && !start) return setError('needOrigin');

    running.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/places', {cache: 'no-store'});
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body.data?.canonicalAvailable === false ||
          !Array.isArray(body.data?.items)) throw new Error('Published places unavailable');
      const items = body.data.items as Shop[];
      setCatalogShops(items);
      const baseCatalog = toMealCatalog(items);
      const tasteFiltered = useTasteProfile && savedPreferences.length > 0
        ? applyTastePreferencesToCatalog(baseCatalog, savedPreferences)
        : {places: baseCatalog, avoidedCount: 0};
      const prepared = prepareMealChoice(tasteFiltered.places, intent, start);
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
      setResult({
        ...finishMealChoice(prepared, intent, routes),
        origin: start,
        routeFailure,
        avoidedByTaste: tasteFiltered.avoidedCount
      });
    } catch {
      setError('catalogFailed');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const selectedId = drawnId ?? result?.recommendedPlaceId ?? null;
  const resultRows = result?.matches ?? [];
  const exclusionReasons = ['over_budget', 'over_walking', 'unknown_price', 'unknown_walking', 'food_mismatch', 'not_dining'] as const;
  const exclusions = exclusionReasons.flatMap(reason => result?.excluded[reason] ? [{reason, count: result.excluded[reason]!}] : []);
  const number = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});
  const needOriginPicker = walking !== '' || priority === 'fastest';
  const matchedShopIds = new Set(resultRows.map(row => row.place.id));
  const decisionShops = matchedShopIds.size > 0
    ? catalogShops.filter(shop => matchedShopIds.has(shop.id))
    : catalogShops;

  return (
    <main className="min-h-screen bg-[#f5f7f1] px-4 pb-28 pt-4 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pine-800">
            <ArrowLeft size={16} aria-hidden />{t('back')}
          </Link>
          <button type="button" onClick={() => setDecisionOpen(true)}
            className={`${buttonClass} border border-pine-200 bg-white text-pine-800 hover:bg-pine-50`}>
            <Dices size={16} aria-hidden />{tDecision('title')}
          </button>
        </div>
        <header className="mb-5 mt-1 rounded-[24px] bg-pine-900 px-5 py-6 text-white sm:px-8 sm:py-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-pine-100">{t('intro')}</p>
        </header>
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
                  <input maxLength={80} value={food} className={fieldClass} placeholder={t('foodExample')}
                    onChange={event => {setFood(event.target.value); resetResults();}} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-sm font-medium">{t('excludeFood')}
                    <input maxLength={80} value={excludedFood} className={fieldClass} placeholder={t('excludeExample')}
                      onChange={event => {setExcludedFood(event.target.value); resetResults();}} />
                  </label>
                  <label className="min-w-0 text-sm font-medium">{t('priority')}
                    <select className={fieldClass} value={priority}
                      onChange={event => {
                        const val = event.target.value;
                        setPriority(val === 'cheapest' || val === 'fastest' ? val : 'balanced');
                        resetResults();
                      }}>
                      <option value="balanced">{t('priorityBalanced')}</option>
                      <option value="cheapest">{t('priorityCheapest')}</option>
                      <option value="fastest">{t('priorityFastest')}</option>
                    </select>
                  </label>
                </div>
                {savedPreferences.length > 0 && (
                  <label className="flex items-start gap-2 rounded-xl border border-pine-100 bg-pine-50/70 px-3 py-2.5 text-sm text-pine-900">
                    <input type="checkbox" checked={useTasteProfile}
                      onChange={event => {setUseTasteProfile(event.target.checked); resetResults();}}
                      className="mt-0.5 h-4 w-4 rounded border-pine-300 text-pine-800 focus:ring-pine-700" />
                    <span>{t('applyTasteProfile', {count: savedPreferences.length})}</span>
                  </label>
                )}
                {needOriginPicker && (
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
              {resultRows.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${buttonClass} border border-line text-pine-800 hover:bg-pine-50`}
                    onClick={() => {
                      const next = nextCandidateId(resultRows.map(({place}) => place.id), selectedId);
                      setDrawnId(next);
                      setPickedMode('swap');
                    }}>
                    <RefreshCw size={15} aria-hidden />{t('tryAnother')}
                  </button>
                  <button type="button" className={`${buttonClass} border border-line text-pine-800 hover:bg-pine-50`}
                    onClick={() => {
                      setDrawnId(chooseMealCandidate(resultRows.map(({place}) => ({id: place.id, name: place.name})))?.id ?? null);
                      setPickedMode('draw');
                    }}>
                    <Dices size={16} aria-hidden />{t('draw')}
                  </button>
                </div>
              )}
            </div>
            <p role="status" className="mt-2 text-sm text-muted">
              {busy ? t('searching') : !result ? t('initial') : resultRows.length ? t('count', {count: resultRows.length}) : t('none')}
              {drawnId && pickedMode === 'draw' && ` · ${t('drawResult', {name: resultRows.find(row => row.place.id === drawnId)?.place.name ?? ''})}`}
            </p>
            {result && result.remaining > 0 && <p className="mt-2 text-xs leading-5 text-muted">
              {t(result.origin ? 'unchecked' : 'more', {count: result.remaining})}
            </p>}
            {(result?.routeFailure || result?.walkingRequestFailed) && <p className="mt-2 text-sm text-amber-800">{t('routeFailure')}</p>}
            {(exclusions.length > 0 || (result?.avoidedByTaste ?? 0) > 0) && <ul className="mt-3 flex flex-wrap gap-2">
              {result && result.avoidedByTaste > 0 && (
                <li className="rounded-full bg-pine-50 px-2.5 py-1 text-xs text-pine-800">
                  {t('avoidedByTaste', {count: result.avoidedByTaste})}
                </li>
              )}
              {exclusions.map(({reason, count}) => <li key={reason} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-muted">
                {t(reason, {count})}
              </li>)}
            </ul>}
            {resultRows.length > 0 && <ul className="mt-4 space-y-2">
              {resultRows.map(({place, groupTotal, route}) => {
                const walked = route?.walking?.status === 'ok' ? route.walking.durationSeconds : null;
                const isFavorited = favorites.includes(place.id);
                const navigation = !place.coordinates ? null
                  : result?.origin ? buildRouteNavigationUrl(result.origin.coordinates, place.coordinates, place.name, 'walking')
                    : buildAmapNavigationUrl({...place, coordinates: place.coordinates, hasCoordinates: true});
                return <li key={place.id} className={`rounded-xl border px-3 py-3 ${selectedId === place.id ? 'border-pine-300 bg-pine-50' : 'border-line'}`}>
                  {selectedId === place.id && (
                    <p className="mb-1 text-xs font-semibold text-pine-800">
                      {t(pickedMode === 'draw' ? 'chosen' : pickedMode === 'swap' ? 'alternative' : 'recommended')}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold">{place.name}</h3>
                      {place.address && <p className="mt-1 break-words text-xs text-muted">{place.address}</p>}
                    </div>
                    <button type="button" disabled={!favoritesLoaded} aria-pressed={isFavorited}
                      aria-label={isFavorited ? tHome('mobile.favorited') : tHome('mobile.favorite')}
                      onClick={() => void toggleFavorite(place.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-pine-700 hover:bg-pine-50 disabled:opacity-50">
                      <Heart size={18} aria-hidden className={isFavorited ? 'fill-current' : ''} />
                    </button>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <div><dt className="text-xs text-muted">{t('priceLabel')}</dt><dd>{place.pricePerPerson === null ? t('unknown') : number.format(place.pricePerPerson)}</dd></div>
                    {groupTotal !== null && <div><dt className="text-xs text-muted">{t('totalLabel')}</dt><dd>{number.format(groupTotal)}</dd></div>}
                    {walked !== null && <div><dt className="text-xs text-muted">{t('walkLabel')}</dt><dd>{t('minutes', {count: Math.ceil(walked / 60)})}</dd></div>}
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-sm font-medium text-pine-800">
                    <Link href={`/shop/${place.id}`} className="inline-flex min-h-10 items-center underline">{t('details')}</Link>
                    {navigation && <a href={navigation} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 underline">
                      {t('navigate')} <ArrowUpRight size={14} aria-hidden />
                    </a>}
                  </div>
                </li>;
              })}
            </ul>}
          </section>
        </div>
        <MealExploration meals={savedMeals} preferences={savedPreferences} />
      </div>
      <MealDecision
        open={decisionOpen}
        matchingPlaces={decisionShops}
        catalogLoading={busy}
        onClose={() => setDecisionOpen(false)}
      />
    </main>
  );
}
