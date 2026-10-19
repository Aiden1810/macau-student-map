'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {ArrowLeft, Check, CheckCircle2, Copy, Inbox, MessageCircle, Send} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {supabase} from '@/lib/supabase';
import {ApiClientError, authenticatedApiRequest} from '@/lib/api/client';
import {contactCopy} from '@/lib/contact/copy';
import {buildFeedbackText, FEEDBACK_CATEGORIES} from '@/lib/contact/feedback';

export default function ContactForm() {
  const locale = useLocale();
  const copy = contactCopy(locale);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [place, setPlace] = useState('');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const copyRequestRef = useRef(0);
  const submissionIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let authChanged = false;
    const applyUser = (id: string | null) => {
      if (!mountedRef.current) return;
      if (userIdRef.current !== id) {submissionIdRef.current = null; setReceipt(null);}
      userIdRef.current = id;
      setUserId(id); setAuthLoading(false);
    };
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      applyUser(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({data}) => {
      if (!authChanged) applyUser(data.session?.user.id ?? null);
    }).catch(() => {if (mountedRef.current) setAuthLoading(false);});
    return () => {mountedRef.current = false; listener.subscription.unsubscribe(); controllerRef.current?.abort(); copyRequestRef.current += 1;};
  }, []);

  const clearCopyStatus = () => {
    copyRequestRef.current += 1; submissionIdRef.current = null;
    setNotice(''); setCopied(false); setManualCopy(false);
  };
  const category = copy.categories[categoryIndex];
  const text = buildFeedbackText({category, place, message, replyTo}, {title: copy.feedbackTitle, category: copy.category, place: copy.place, message: copy.message, replyTo: copy.replyTo});
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm text-ink outline-none focus:border-pine-700 focus:ring-2 focus:ring-pine-700/15 disabled:opacity-60';
  const valid = () => {if (message.trim().length >= 10) return true; setNotice(copy.invalid); return false;};
  const copyFeedback = async () => {
    if (!valid()) return;
    const requestId = ++copyRequestRef.current;
    try {
      await navigator.clipboard.writeText(text);
      if (requestId !== copyRequestRef.current) return;
      setCopied(true); setNotice(copy.copied); setManualCopy(false);
    } catch {
      if (requestId !== copyRequestRef.current) return;
      setNotice(copy.copyFailed); setManualCopy(true);
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current || !valid()) return;
    busyRef.current = true; setSending(true); setNotice('');
    const controller = new AbortController(); controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const {data} = await supabase.auth.getSession();
      if (!data.session?.access_token) {setUserId(null); setNotice(copy.loginNotice); return;}
      submissionIdRef.current ??= crypto.randomUUID();
      const result = await authenticatedApiRequest<{id: string}>('/api/feedback', data.session.access_token, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({id: submissionIdRef.current, category: FEEDBACK_CATEGORIES[categoryIndex], place, message, replyTo, locale})
      });
      if (mountedRef.current && userIdRef.current === data.session.user.id) {copyRequestRef.current += 1; setReceipt(result.id);}
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {setUserId(null); setNotice(copy.loginNotice);}
      else if (error instanceof ApiClientError && error.code === 'SCHEMA_UNAVAILABLE') setNotice(copy.notEnabled);
      else if (error instanceof ApiClientError && error.code === 'CONFLICT') {submissionIdRef.current = null; setNotice(copy.failed);}
      else if (controller.signal.aborted) setNotice(copy.uncertain);
      else setNotice(copy.failed);
    } finally {
      window.clearTimeout(timeout); busyRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  };
  const another = () => {setReceipt(null); setPlace(''); setMessage(''); setReplyTo(''); setCategoryIndex(0); clearCopyStatus();};

  return <main className="min-h-[100dvh] bg-canvas px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-6 text-ink sm:px-6 sm:pt-10">
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-pine-700"><ArrowLeft size={17} />{copy.back}</Link>
      <header className="mb-8 mt-5"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-700 text-white"><MessageCircle size={24} /></span><p className="mt-5 text-sm font-medium text-pine-700">{copy.subtitle}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-muted">{copy.intro}</p></header>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        {receipt ? <section role="status" className="min-w-0 rounded-2xl border border-pine-200 bg-white p-6"><CheckCircle2 size={32} className="text-pine-700" /><h2 className="mt-4 text-xl font-semibold">{copy.success}</h2><p className="mt-3 text-sm leading-7 text-muted">{copy.successDetail}</p><p className="mt-5 text-xs text-muted">{copy.receipt}</p><p className="mt-2 break-all rounded-xl bg-canvas p-3 font-mono text-sm">{receipt}</p><button type="button" onClick={another} className="mt-5 min-h-12 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white">{copy.another}</button></section> :
        <form onSubmit={event => void send(event)} onChange={clearCopyStatus} className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6">
          {(authLoading || !userId) && <div className="mb-5 rounded-xl bg-pine-50 p-3 text-sm leading-6 text-pine-800"><p>{authLoading ? copy.checkingLogin : copy.loginNotice}</p>{!authLoading && <Link href="/login" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-10 items-center font-semibold underline underline-offset-4">{copy.loginAction} ↗</Link>}</div>}
          <fieldset disabled={sending}><legend className="text-base font-semibold">{copy.formTitle}</legend><div className="mt-4 grid grid-cols-2 gap-2">{copy.categories.map((label, index) => <button key={label} type="button" aria-pressed={categoryIndex === index} onClick={() => {setCategoryIndex(index); clearCopyStatus();}} className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-medium ${categoryIndex === index ? 'border-pine-700 bg-pine-50 text-pine-800' : 'border-line text-muted hover:bg-canvas'}`}>{label}</button>)}</div></fieldset>
          <label className="mt-6 block text-sm font-medium" htmlFor="feedback-place">{copy.place} <span className="ml-1 text-xs font-normal text-muted">{copy.optional}</span><input id="feedback-place" disabled={sending} value={place} onChange={event => setPlace(event.target.value)} maxLength={200} placeholder={copy.placePlaceholder} className={inputClass} /></label>
          <div className="mt-5"><label className="block text-sm font-medium" htmlFor="feedback-message">{copy.message}</label><textarea id="feedback-message" disabled={sending} required minLength={10} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={6} placeholder={copy.messagePlaceholder} className={`${inputClass} resize-y`} /></div><p className="mt-1 text-right text-xs tabular-nums text-muted">{message.length} / 2000</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="feedback-reply">{copy.replyTo} <span className="ml-1 text-xs font-normal text-muted">{copy.optional}</span><input id="feedback-reply" disabled={sending} value={replyTo} onChange={event => setReplyTo(event.target.value)} maxLength={200} placeholder={copy.replyPlaceholder} className={inputClass} /></label>
          <p className="mt-4 text-xs leading-6 text-muted">{copy.privacy}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={sending || authLoading || !userId} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />{sending ? copy.sending : copy.send}</button><button type="button" disabled={sending} onClick={() => void copyFeedback()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-pine-800 hover:bg-canvas disabled:opacity-50">{copied ? <Check size={16} /> : <Copy size={16} />}{copy.copy}</button></div>
          <p role="status" aria-live="polite" className="mt-3 text-sm text-pine-800">{notice}</p>
          {manualCopy && <label className="mt-3 block text-sm">{copy.preview}<textarea readOnly value={text} rows={8} className={inputClass} onFocus={event => event.currentTarget.select()} /></label>}
        </form>}
        <aside className="space-y-4"><section className="rounded-2xl bg-pine-800 p-5 text-white"><Inbox size={20} /><h2 className="mt-3 font-semibold">{copy.contactTitle}</h2><ol className="mt-4 space-y-4">{copy.steps.map((step, index) => <li key={step} className="flex gap-3 text-xs leading-6 text-white/85"><span className="font-mono text-white/60">0{index + 1}</span><span>{step}</span></li>)}</ol></section><section className="rounded-2xl border border-line p-5"><h2 className="text-sm font-semibold">{copy.note}</h2><p className="mt-2 text-xs leading-6 text-muted">{copy.noteBody}</p></section></aside>
      </div>
    </div>
  </main>;
}
