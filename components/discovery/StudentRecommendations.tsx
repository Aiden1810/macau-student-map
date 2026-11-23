
'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import Image from 'next/image';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import ImageUpload from '@/components/ImageUpload';
import {mediaTypes, recommendationInput, targetArgs, type RecommendationInput, type OwnRecommendation,
  type PublicRecommendation, type RecommendationTarget} from '@/lib/discovery/business';
import {discoveryPost, uploadRecommendationImage} from '@/lib/discovery/client';
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {supabase} from '@/lib/supabase';
import {DiscoveryAccountProvider, useDiscoveryAccount} from './DiscoveryAccount';
import {discoveryErrorKey} from './copy';

const input = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm';
const action = 'inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-medium text-pine-800 disabled:opacity-60';

export function RecommendationContent({entry}: {entry: PublicRecommendation}) {
  const t = useTranslations('Discovery');
  return <>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.reason}</p>
    <dl className="mt-2 space-y-1 text-xs text-muted">
      {entry.dishes && <div><dt className="inline font-semibold">{t('dishes')} </dt><dd className="inline">{entry.dishes}</dd></div>}
      {entry.scene && <div><dt className="inline font-semibold">{t('scene')} </dt><dd className="inline">{entry.scene}</dd></div>}
      {entry.amount !== null && <div><dt className="inline font-semibold">{t(entry.amount_kind === 'total' ? 'total' : 'perPerson')} </dt>
        <dd className="inline">{entry.currency} {entry.amount}</dd></div>}
    </dl>
  </>;
}

export default function StudentRecommendations(props: {target: RecommendationTarget; returnPath: string; canSubmit?: boolean}) {
  return <DiscoveryAccountProvider><RecommendationPanel {...props} /></DiscoveryAccountProvider>;
}

export function RecommendationPanel({target, returnPath, canSubmit = true}: {
  target: RecommendationTarget; returnPath: string; canSubmit?: boolean
}) {
  const t = useTranslations('Discovery');
  const locale = useLocale();
  const session = useDiscoveryAccount();
  const account = session?.user.id;
  const {p_place, p_poi} = targetArgs(target);
  const [entries, setEntries] = useState<PublicRecommendation[]>([]);
  const [ownState, setOwnState] = useState<{account: string; entries: OwnRecommendation[]} | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const [ownError, setOwnError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [after, setAfter] = useState<PublicRecommendation | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const signal = AbortSignal.any([AbortSignal.timeout(10000), controller.signal]);
    void supabase.rpc('list_student_recommendations', {
      p_place, p_poi, p_before: after?.created_at ?? null, p_before_id: after?.id ?? null
    }).abortSignal(signal).then(({data, error}) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      if (error) {setError(true); return;}
      const rows = (data ?? []) as PublicRecommendation[];
      setEntries(previous => after ? [...previous, ...rows.slice(0, 20)] : rows.slice(0, 20));
      setMore(rows.length > 20);
    });
    return () => controller.abort();
  }, [p_place, p_poi, after, revision]);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([AbortSignal.timeout(10000), controller.signal]);
    setOwnError(false);
    void supabase.rpc('my_student_recommendations', {p_place, p_poi}).abortSignal(signal).then(({data, error}) => {
      if (controller.signal.aborted) return;
      if (error) setOwnError(true);
      else setOwnState({account, entries: data ?? []});
    });
    return () => controller.abort();
  }, [account, p_place, p_poi, revision]);

  function refresh() {
    setAfter(null);
    setEntries([]);
    setRevision(previous => previous + 1);
  }

  async function remove(id: string) {
    if (deleting || !confirm(t('confirmRemove'))) return;
    setDeleting(id);
    const {data, error} = await supabase.rpc('remove_my_student_recommendation', {p_id: id}).abortSignal(AbortSignal.timeout(10000));
    setDeleting(null);
    setOwnError(Boolean(error || !data));
    if (!error && data) refresh();
  }

  const own = ownState?.account === account ? ownState?.entries ?? [] : [];
  return <section className="space-y-3 rounded-2xl border border-line bg-white p-4 text-ink">
    <h2 className="text-lg font-semibold">{t('recommended')}</h2>
    {loading && <p role="status" className="text-sm text-muted">{t('loading')}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-700">
      {t('requestFailed')}<button className={action} type="button" onClick={() => setRevision(old => old + 1)}>{t('retry')}</button>
    </div>}
    {!entries.length && !loading && !error && <p className="text-sm text-muted">{t('noRecommendations')}</p>}
    {entries.map(entry => <article key={entry.id} className="rounded-xl border border-line p-3">
      <RecommendationContent entry={entry} />
      {entry.image_path && <Image src={'/api/discovery/recommendations/' + entry.id + '/image'} alt={t('photo')}
        width={160} height={120} unoptimized className="mt-2 h-28 w-auto rounded-lg object-contain" />}
      <time dateTime={entry.created_at} className="mt-2 block text-xs text-muted">{new Date(entry.created_at).toLocaleDateString(locale)}</time>
    </article>)}
    {more && <button className={action} type="button" disabled={loading || error} onClick={() => setAfter(entries.at(-1) ?? null)}>{t('more')}</button>}
    {account && ownError && <p role="alert" className="text-sm text-rose-700">{t('requestFailed')} <button type="button" onClick={refresh} className="underline">{t('retry')}</button></p>}
    {own.length > 0 && <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer text-sm font-medium">{t('mine')}</summary>
      {own.map(item => <div key={item.id} className="mt-2 flex items-start justify-between gap-3 border-t border-line py-2">
        <div className="min-w-0"><p className="break-words text-sm">{item.reason}</p><p className="text-xs text-muted">{t(item.status)}</p></div>
        <button type="button" className={action} disabled={Boolean(deleting)} onClick={() => void remove(item.id)}>{t('remove')}</button>
      </div>)}
    </details>}
    {canSubmit && session === null && <Link href={{pathname: '/login', query: {next: '/' + locale + returnPath}}} className={action}>{t('signInToRecommend')}</Link>}
    {canSubmit && session && <RecommendationForm key={session.user.id} target={target} onSaved={refresh} />}
  </section>;
}

function RecommendationForm({target, onSaved}: {target: RecommendationTarget; onSaved: () => void}) {
  const t = useTranslations('Discovery');
  const session = useDiscoveryAccount();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = useRef<{id: string; uploaded: boolean; submitted?: RecommendationInput} | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => {pending.current?.abort();}, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || pending.current || processing) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const amountText = String(fields.get('amount') ?? '').trim();
    const candidate = draft.current ?? {id: crypto.randomUUID(), uploaded: false};
    const parsed = recommendationInput.safeParse(candidate.submitted ?? {
      id: candidate.id, target, reason: fields.get('reason'), dishes: fields.get('dishes'),
      scene: fields.get('scene'), hasImage: Boolean(file),
      spending: amountText ? {amount: Number(amountText), kind: fields.get('kind'), currency: fields.get('currency')} : undefined
    });
    setNotice(null);
    if (!parsed.success) {setError('invalidRecommendation'); return;}
    draft.current = candidate;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError(null);
    try {
      if (file && !candidate.uploaded) {
        await discoveryPost('recommendations?validate=true', parsed.data, {token: session.access_token, signal: controller.signal});
        await uploadRecommendationImage(candidate.id, file, session.access_token, controller.signal);
        candidate.uploaded = true;
      }
      candidate.submitted = parsed.data;
      await discoveryPost('recommendations', candidate.submitted, {token: session.access_token, signal: controller.signal});
      if (controller.signal.aborted) return;
      draft.current = null;
      form.reset();
      setFile(null);
      setNotice('submitted');
      onSaved();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (!candidate.submitted) draft.current = null;
      const code = failure instanceof DiscoveryError ? failure.code : null;
      setError(code === 'PHOTO_FAILED' ? 'photoFailed' : discoveryErrorKey(code));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <details className="rounded-xl border border-line bg-pine-50 p-3">
    <summary className="cursor-pointer font-medium text-pine-800">{t('submitTitle')}</summary>
    <form onSubmit={submit} className="mt-3 space-y-3">
      <p className="text-sm text-muted">{t('moderationHint')}</p>
      <label className="block text-sm">{t('reason')}<textarea name="reason" className={input} rows={3} required maxLength={3000} disabled={saving || Boolean(draft.current?.submitted)} /></label>
      <label className="block text-sm">{t('dishes')}<input name="dishes" className={input} maxLength={200} disabled={saving || Boolean(draft.current?.submitted)} /></label>
      <label className="block text-sm">{t('scene')}<input name="scene" className={input} maxLength={100} disabled={saving || Boolean(draft.current?.submitted)} /></label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="col-span-2 text-sm sm:col-span-1">{t('amount')}
          <input name="amount" className={input} type="number" min="0" max="100000" step="0.01" disabled={saving || Boolean(draft.current?.submitted)} />
        </label>
        <label className="text-sm">{t('currency')}
          <select name="currency" className={input} disabled={saving || Boolean(draft.current?.submitted)}>
            {['MOP', 'HKD', 'CNY', 'USD', 'OTHER'].map(currency => <option key={currency} value={currency}>{currency === 'OTHER' ? t('otherCurrency') : currency}</option>)}
          </select>
        </label>
        <label className="text-sm">{t('amountKind')}
          <select name="kind" className={input} disabled={saving || Boolean(draft.current?.submitted)}><option value="per_person">{t('perPerson')}</option><option value="total">{t('total')}</option></select>
        </label>
      </div>
      <ImageUpload disabled={saving || Boolean(draft.current)} buttonText={t('photo')} processingText={t('loading')}
        onProcessingChange={setProcessing} onUpload={next => {
          if (!mediaTypes.includes(next.type) || next.size > 1048576) throw new Error(t('photoInvalid'));
          setFile(next);
        }} />
      {file && <p className="break-words text-xs text-muted">{file.name} {!draft.current &&
        <button type="button" className="ml-2 underline" onClick={() => setFile(null)}>{t('remove')}</button>}</p>}
      {notice && <p role="status" className="text-sm text-pine-800">{t(notice)}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{t(error)}</p>}
      <button type="submit" className={action} disabled={saving || processing}>{t(saving ? 'loading' : 'submit')}</button>
    </form>
  </details>;
}
