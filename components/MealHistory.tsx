'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, BookOpen} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {
  macauToday, mealDraftSchema, mealFeedback, preferenceDraftSchema, preferenceKinds, preferenceSentiments,
  suggestTastePreferences, type MealDraft, type MealEntry, type PreferenceDraft, type TastePreference
} from '@/lib/meal-history/model';
import {deleteMealJournalItem, readMeals, readPreferences, saveMeal, savePreference} from '@/lib/meal-history/repository';
import MealExploration from './MealExploration';

const emptyMeal = (): MealDraft => ({restaurant_name: '', cuisine: '', eaten_on: macauToday(), feedback: null, note: ''});
const emptyPreference: PreferenceDraft = {kind: 'cuisine', label: '', sentiment: 'like'};
const fieldClass = 'min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm';
const primaryClass = 'min-h-11 rounded-lg bg-pine-800 px-4 text-sm font-medium text-white disabled:opacity-50';
const plainClass = 'min-h-10 rounded-lg px-3 text-sm font-medium text-pine-800 hover:bg-pine-50 disabled:opacity-50';

function MealJournal({userId}: {userId: string}) {
  const t = useTranslations('MealHistory');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [preferences, setPreferences] = useState<TastePreference[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [mode, setMode] = useState<'meal' | 'taste'>('meal');
  const [meal, setMeal] = useState(emptyMeal);
  const [preference, setPreference] = useState(emptyPreference);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{key: 'saved' | 'removed' | 'invalid' | 'writeFailed' | 'duplicate'; error?: boolean} | null>(null);
  const savingRef = useRef(false);
  const draftId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([readMeals(userId, page), readPreferences(userId)]).then(([history, profile]) => {
      if (cancelled) return;
      if (page > 0 && history.items.length === 0) {
        setPage(page - 1);
        return;
      }
      setMeals(history.items);
      setHasMore(history.hasMore);
      setPreferences(profile);
      setLoadState('ready');
    }).catch(() => {if (!cancelled) setLoadState('error');});
    return () => {cancelled = true;};
  }, [userId, page, revision]);

  function resetDraft() {
    setEditing(null);
    setDeleting(null);
    setMeal(emptyMeal());
    setPreference(emptyPreference);
    draftId.current = null;
  }

  function reload() {
    setLoadState('loading');
    setRevision(previous => previous + 1);
  }

  async function change(action: () => Promise<void>, success: 'saved' | 'removed') {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await action();
      resetDraft();
      setMessage({key: success});
      reload();
    } catch (error) {
      const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
      setMessage({key: duplicate ? 'duplicate' : 'writeFailed', error: true});
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'meal') {
      const parsed = mealDraftSchema.safeParse(meal);
      if (!parsed.success || parsed.data.eaten_on > macauToday()) {
        setMessage({key: 'invalid', error: true});
        return;
      }
      const id = editing ?? (draftId.current ??= crypto.randomUUID());
      void change(() => saveMeal(userId, id, parsed.data, Boolean(editing)), 'saved');
      return;
    }
    const parsed = preferenceDraftSchema.safeParse(preference);
    if (!parsed.success) {
      setMessage({key: 'invalid', error: true});
      return;
    }
    const id = editing ?? (draftId.current ??= crypto.randomUUID());
    void change(() => savePreference(userId, id, parsed.data, Boolean(editing)), 'saved');
  }

  const rows = mode === 'meal' ? meals : preferences;
  const suggestions = page === 0 && loadState === 'ready' ? suggestTastePreferences(meals, preferences) : [];
  const formDisabled = saving || loadState !== 'ready';

  return (
    <>
      <div className="mb-5 inline-flex rounded-xl border border-line bg-white p-1" aria-label={t('title')}>
        {(['meal', 'taste'] as const).map(option => (
          <button key={option} type="button" disabled={saving} aria-pressed={mode === option}
            className={`${plainClass} aria-pressed:bg-pine-100`}
            onClick={() => {
              setMode(option);
              resetDraft();
              setMessage(null);
              if (option === 'taste' && page !== 0) {
                setLoadState('loading');
                setPage(0);
              }
            }}>{t(option)}</button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="self-start rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{t(editing ? 'edit' : mode === 'meal' ? 'newMeal' : 'newTaste')}</h2>
          {mode === 'meal' && <p className="mt-1 text-sm text-muted">{t('confirmationHint')}</p>}
          <form ref={formRef} onSubmit={submit} className="mt-4">
            <fieldset disabled={formDisabled} className="space-y-3">
              {mode === 'meal' ? <>
                <label className="block space-y-1 text-sm">{t('restaurant')}<input className={fieldClass}
                  required maxLength={120} value={meal.restaurant_name} onChange={event => setMeal({...meal, restaurant_name: event.target.value})} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">{t('date')}<input type="date" className={fieldClass}
                    required max={macauToday()} value={meal.eaten_on} onChange={event => setMeal({...meal, eaten_on: event.target.value})} /></label>
                  <label className="block space-y-1 text-sm">{t('cuisineOptional')}<input className={fieldClass}
                    maxLength={80} value={meal.cuisine} onChange={event => setMeal({...meal, cuisine: event.target.value})} /></label>
                </div>
                <label className="block space-y-1 text-sm">{t('feedback')}<select className={fieldClass} value={meal.feedback ?? ''}
                  onChange={event => setMeal({...meal, feedback: (event.target.value || null) as MealDraft['feedback']})}>
                  <option value="">{t('noFeedback')}</option>
                  {mealFeedback.map(item => <option value={item} key={item}>{t(item)}</option>)}
                </select></label>
                <label className="block space-y-1 text-sm">{t('note')}<textarea className={fieldClass} rows={3} maxLength={280}
                  value={meal.note} onChange={event => setMeal({...meal, note: event.target.value})} /></label>
              </> : <>
                <label className="block space-y-1 text-sm">{t('kind')}<select className={fieldClass} value={preference.kind}
                  onChange={event => setPreference({...preference, kind: event.target.value as PreferenceDraft['kind']})}>
                  {preferenceKinds.map(item => <option value={item} key={item}>{t(item)}</option>)}
                </select></label>
                <label className="block space-y-1 text-sm">{t('preferenceLabel')}<input className={fieldClass} required maxLength={120}
                  value={preference.label} onChange={event => setPreference({...preference, label: event.target.value})} /></label>
                <label className="block space-y-1 text-sm">{t('sentiment')}<select className={fieldClass} value={preference.sentiment}
                  onChange={event => setPreference({...preference, sentiment: event.target.value as PreferenceDraft['sentiment']})}>
                  {preferenceSentiments.map(item => <option value={item} key={item}>{t(item)}</option>)}
                </select></label>
              </>}
              <div className="flex gap-2">
                <button type="submit" className={primaryClass}>{t(mode === 'meal' && !editing ? 'confirmMeal' : 'save')}</button>
                {editing && <button type="button" className={plainClass} onClick={resetDraft}>{t('cancel')}</button>}
              </div>
            </fieldset>
          </form>
          {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-sm ${message.error ? 'text-rose-700' : 'text-pine-800'}`}>
            {t(message.key)}
          </p>}
        </section>
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{t(mode === 'meal' ? 'history' : 'profile')}</h2>
          {loadState === 'loading' && <p className="mt-3 text-sm text-muted" role="status">{t('loading')}</p>}
          {loadState === 'error' && <div className="mt-3 text-sm">
            <p role="alert" className="text-rose-700">{t('loadFailed')}</p>
            <button type="button" className={plainClass} onClick={reload}>{t('retry')}</button>
          </div>}
          {loadState === 'ready' && <>
            {rows.length === 0 && <p className="mt-3 text-sm text-muted">{t(mode === 'meal' ? 'noMeals' : 'noTaste')}</p>}
            <ul className="mt-2 divide-y divide-stone-100">
              {rows.map(row => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-x-2 py-3">
                  <div className="min-w-0 basis-36 grow">
                    <p className="break-words font-medium">{'restaurant_name' in row ? row.restaurant_name : row.label}</p>
                    <p className="break-words text-sm text-muted">
                      {'restaurant_name' in row
                        ? [row.eaten_on, row.cuisine, row.feedback && t(row.feedback)].filter(Boolean).join(' · ')
                        : `${t(row.kind)} · ${t(row.sentiment)}`}
                    </p>
                    {'note' in row && row.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.note}</p>}
                  </div>
                  {deleting === row.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={saving} className={`${plainClass} text-rose-700`}
                        onClick={() => void change(() => deleteMealJournalItem(userId, mode, row.id), 'removed')}>{t('confirmDelete')}</button>
                      <button type="button" disabled={saving} className={plainClass} onClick={() => setDeleting(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={saving} className={plainClass} onClick={() => {
                        resetDraft();
                        setEditing(row.id);
                        if ('restaurant_name' in row) setMeal(row);
                        else setPreference(row);
                        formRef.current?.querySelector<HTMLElement>('input, select')?.focus();
                      }}>{t('edit')}</button>
                      <button type="button" disabled={saving} className={plainClass} onClick={() => setDeleting(row.id)}>{t('delete')}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {mode === 'meal' && (page > 0 || hasMore) && <div className="mt-2 flex justify-between">
              <button type="button" className={plainClass} disabled={page === 0 || saving}
                onClick={() => {setLoadState('loading'); setPage(previous => previous - 1);}}>{t('newer')}</button>
              <button type="button" className={plainClass} disabled={!hasMore || saving}
                onClick={() => {setLoadState('loading'); setPage(previous => previous + 1);}}>{t('older')}</button>
            </div>}
            {mode === 'taste' && suggestions.length > 0 && <div className="mt-4 rounded-xl bg-pine-50 p-3">
              <h3 className="font-medium">{t('suggestions')}</h3>
              <p className="mt-1 text-sm text-muted">{t('suggestionsHint')}</p>
              <ul className="mt-2 space-y-2">
                {suggestions.map(suggestion => (
                  <li key={`${suggestion.kind}:${suggestion.label}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm">{suggestion.label} · {t(suggestion.kind)} · {t(suggestion.sentiment)}</span>
                    <button type="button" disabled={saving} className={plainClass}
                      onClick={() => {
                        resetDraft();
                        setPreference(suggestion);
                        formRef.current?.querySelector('input')?.focus();
                      }}>{t('useSuggestion')}</button>
                  </li>
                ))}
              </ul>
            </div>}
          </>}
        </section>
      </div>
      {mode === 'taste' && page === 0 && loadState === 'ready' && (
        <MealExploration meals={meals} preferences={preferences} />
      )}
    </>
  );
}

export default function MealHistory() {
  const t = useTranslations('MealHistory');
  const locale = useLocale();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-stone-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-pine-800">
          <ArrowLeft size={16} aria-hidden />{t('home')}
        </Link>
        <header className="mb-5 mt-2 rounded-2xl bg-pine-900 p-5 text-white sm:p-7">
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <BookOpen size={24} aria-hidden />{t('title')}
          </h1>
          <p className="mt-2 text-sm text-pine-100">{t('privacy')}</p>
        </header>
        {userId === undefined ? <p role="status" className="text-sm text-muted">{t('loading')}</p>
          : userId ? <MealJournal key={userId} userId={userId} />
          : <Link href={{pathname: '/login', query: {next: `/${locale}/meal-history`}}}
            className={`inline-flex items-center ${primaryClass}`}>{t('login')}</Link>}
      </div>
    </main>
  );
}
