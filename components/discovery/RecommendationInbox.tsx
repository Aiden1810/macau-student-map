
'use client';

import Image from 'next/image';
import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import type {OwnRecommendation, PublicRecommendation} from '@/lib/discovery/business';
import {DiscoveryAccountProvider, useDiscoveryAccount} from './DiscoveryAccount';
import {RecommendationContent} from './StudentRecommendations';

type InboxRow = PublicRecommendation & Pick<OwnRecommendation, 'status'> & {
  place_id: string | null; place_name: string | null; poi_id: string | null
};
const action = 'inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-medium text-pine-800 disabled:opacity-60';

export default function RecommendationInbox() {
  return <DiscoveryAccountProvider><AccountInbox /></DiscoveryAccountProvider>;
}

function AccountInbox() {
  const account = useDiscoveryAccount()?.user.id;
  return account ? <Inbox key={account} account={account} /> : null;
}

function Inbox({account}: {account: string}) {
  const t = useTranslations('Discovery');
  const session = useDiscoveryAccount();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [after, setAfter] = useState<InboxRow | null>(null);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const locks = useRef(false);

  function reload() {
    setAfter(null);
    setRows([]);
    setRevision(old => old + 1);
  }

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void supabase.rpc('admin_student_recommendations', {
      p_pending: pendingOnly, p_before: after?.created_at ?? null, p_before_id: after?.id ?? null
    }).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])).then(({data, error}) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      if (error) {setError(true); return;}
      const items = (data ?? []) as InboxRow[];
      setRows(previous => after ? [...previous, ...items.slice(0, 20)] : items.slice(0, 20));
      setMore(items.length > 20);
    });
    return () => controller.abort();
  }, [account, pendingOnly, after, revision]);

  async function moderate(item: InboxRow, choice: 'approved' | 'rejected') {
    if (locks.current) return;
    locks.current = true;
    setWorking(item.id);
    setError(false);
    try {
      const {data, error} = await supabase.rpc('moderate_student_recommendation', {
        p_id: item.id, p_expected: item.status, p_decision: choice
      }).abortSignal(AbortSignal.timeout(10000));
      if (error || !data) throw error ?? new Error('Conflict');
      reload();
    } catch {setError(true);}
    finally {setWorking(null); locks.current = false;}
  }

  return <section className="mb-5 space-y-3 rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-semibold text-ink">{t('adminTitle')}</h2>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={pendingOnly} onChange={event => {setPendingOnly(event.target.checked); reload();}} />{t('pendingOnly')}
      </label>
    </div>
    {loading && <p role="status" className="text-sm text-muted">{t('loading')}</p>}
    {error && <div role="alert" className="flex items-center gap-2 text-sm text-rose-700">{t('requestFailed')} <button type="button" className={action} onClick={reload}>{t('retry')}</button></div>}
    {!loading && !error && !rows.length && <p className="text-sm text-muted">{t('emptyQueue')}</p>}
    {rows.map(item => <article key={item.id} className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {item.place_name || (item.poi_id ? 'POI ' + item.poi_id : t('placeUnavailable'))}
        {item.place_id && <Link href={'/shop/' + item.place_id} className="underline">{t('details')}</Link>}
        {!item.place_id && item.poi_id && <Link href={'/discover/poi/' + item.poi_id} className="underline">{t('details')}</Link>}
        <span className="rounded-full bg-pine-50 px-2 py-1 text-xs text-pine-800">{t(item.status)}</span>
      </div>
      <RecommendationContent entry={item} />
      {item.image_path && session && <PrivatePreview id={item.id} token={session.access_token} />}
      <div className="flex gap-2">
        {item.status !== 'approved' && <button className={action} type="button" disabled={Boolean(working)} onClick={() => void moderate(item, 'approved')}>{t('approve')}</button>}
        {item.status !== 'rejected' && <button className={action} type="button" disabled={Boolean(working)} onClick={() => void moderate(item, 'rejected')}>{t('hide')}</button>}
      </div>
    </article>)}
    {more && <button className={action} type="button" disabled={loading || error} onClick={() => setAfter(rows.at(-1) ?? null)}>{t('more')}</button>}
  </section>;
}

function PrivatePreview({id, token}: {id: string; token: string}) {
  const t = useTranslations('Discovery');
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function preview() {
    if (loading) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setFailed(false);
    setLoading(true);
    try {
      const response = await fetch('/api/discovery/recommendations/' + id + '/image', {
        headers: {Authorization: 'Bearer ' + token}, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
      });
      if (!response.ok) throw new Error('Preview unavailable');
      const {url} = await response.json();
      if (!controller.signal.aborted) setUrl(url);
    } catch {if (!controller.signal.aborted) setFailed(true);}
    finally {if (!controller.signal.aborted) setLoading(false);}
  }
  return <div className="space-y-2">
    {url && <Image src={url} alt={t('photo')} width={160} height={120} unoptimized loading="eager" className="h-28 w-auto rounded-lg object-contain" />}
    {failed && <p role="alert" className="text-sm text-rose-700">{t('photoFailed')}</p>}
    <button className={action} type="button" disabled={loading} onClick={() => void preview()}>{t(loading ? 'loading' : 'previewPhoto')}</button>
  </div>;
}
