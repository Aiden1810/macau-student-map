"use client";

import {LoaderCircle} from 'lucide-react';
import type {AssistantCopy} from '@/lib/assistant/copy';
import type {ChatMessage} from './chat-types';

export default function AssistantAnswer({message, copy}: {message: ChatMessage; copy: AssistantCopy}) {
  const {decision, intent} = message;
  const winner = decision?.rows.find(row => row.place.id === decision.recommendedPlaceId);
  const showComparison = !message.loading && !message.error && !message.historical &&
    intent?.intent === 'recommend' && decision?.reason === 'recommended' && Boolean(winner);
  const explanation = (
    <div className={`whitespace-pre-wrap break-words text-sm leading-7 ${message.error ? 'text-red-700' : 'text-stone-700'}`}>
      {message.loading && <LoaderCircle size={14} className="mr-2 inline animate-spin text-pine-700 motion-reduce:animate-none" aria-hidden="true" />}
      {message.text}
    </div>
  );
  if (!showComparison || !decision || !intent || !winner) return explanation;

  return (
    <>
      <section aria-label={copy.recommend} className="min-w-0 overflow-hidden rounded-2xl border border-pine-100 bg-white">
        <div className="bg-pine-50 px-3 py-4 sm:px-4">
          <p className="text-xs font-medium text-pine-700">{copy.recommend}</p>
          <h3 className="mt-1 break-words text-xl font-semibold text-pine-900">{winner.place.name}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">{copy[intent.priority]}</p>
        </div>
        <div className={`grid grid-cols-2 divide-x divide-stone-100 ${decision.rows.length > 2 ? 'sm:grid-cols-4' : ''}`}>
          {decision.rows.map(row => (
            <article key={row.place.id} className={`min-w-0 break-words border-t border-stone-100 px-3 py-4 ${row.place.id === winner.place.id ? 'bg-pine-50/30' : ''}`}>
              <h4 className="min-h-12 text-sm font-semibold leading-6 text-ink">{row.place.name}</h4>
              <dl className="mt-3 space-y-3 text-xs">
                <div><dt className="leading-5 text-muted">{copy.reference}</dt>
                  <dd className="mt-1 text-base font-semibold tabular-nums text-ink">{row.place.pricePerPerson !== null && Number.isFinite(row.place.pricePerPerson) ? `CNY ${row.place.pricePerPerson}` : copy.unavailable}</dd>
                </div>
                {(['taxi', 'transit', 'walking'] as const).map(mode => {
                  const route = row.route?.[mode];
                  return <div key={mode}><dt className="leading-5 text-muted">{copy[mode]}</dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums text-ink">{route?.status === 'ok' && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0
                      ? <>{Math.ceil(route.durationSeconds / 60)} <span className="text-xs font-normal text-muted">{copy.minutes}</span></> : copy.unavailable}</dd>
                  </div>;
                })}
              </dl>
            </article>
          ))}
        </div>
      </section>
      <details className="mt-3 text-sm text-stone-700">
        <summary className="min-h-10 cursor-pointer py-2 font-medium focus-visible:ring-2 focus-visible:ring-pine-700">{copy.explanation}</summary>
        {explanation}
      </details>
    </>
  );
}
