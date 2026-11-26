'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Dices, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {matchesLaunchCategory} from '@/lib/domain/place-types';
import {chooseMealCandidate, countMealVotes, mealWheelRotation, type MealCandidate} from '@/lib/meal-decision/draw';
import type {Shop} from '@/types/shop';

const sectorColors = ['#166534', '#d99a2b', '#2f6b55', '#c8644d', '#4d8b6f', '#1d4d3e'];
const sectorColor = (index: number) => sectorColors[index % sectorColors.length];
const wheelLabel = (name: string) => name.length > 6 ? `${name.slice(0, 5)}…` : name;

function WheelGraphic({candidates, rotation, animate}: {
  candidates: readonly MealCandidate[];
  rotation: number;
  animate: boolean;
}) {
  const count = candidates.length;
  const cx = 100;
  const cy = 100;
  const radius = 94;

  const sectorPath = (index: number) => {
    const startAngle = ((index * 360) / count - 90) * (Math.PI / 180);
    const endAngle = (((index + 1) * 360) / count - 90) * (Math.PI / 180);
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = 360 / count > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="relative mx-auto grid h-48 w-48 place-items-center sm:h-52 sm:w-52" aria-hidden>
      <div className="absolute -top-1 z-10 border-x-[8px] border-t-[14px] border-x-transparent border-t-stone-900" />
      <svg
        viewBox="0 0 200 200"
        className={`h-full w-full rounded-full border-4 border-white shadow-sm ${animate ? 'motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out' : ''}`}
        style={{transform: `rotate(${rotation}deg)`}}
      >
        {count === 1 ? (
          <>
            <circle cx={cx} cy={cy} r={radius} fill={sectorColor(0)} />
            <text x={cx} y={cy - 26} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="600">
              {wheelLabel(candidates[0].name)}
            </text>
          </>
        ) : (
          candidates.map((candidate, index) => {
            const midDeg = ((index + 0.5) * 360) / count;
            return (
              <g key={candidate.id}>
                <path d={sectorPath(index)} fill={sectorColor(index)} stroke="#ffffff" strokeWidth="1.5" />
                {count <= 10 && (
                  <text
                    x={cx}
                    y={cy - (count <= 4 ? 54 : 60)}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={count <= 4 ? '11.5' : count <= 6 ? '10' : '8.5'}
                    fontWeight="600"
                    transform={`rotate(${midDeg} ${cx} ${cy})`}
                  >
                    {wheelLabel(candidate.name)}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
      <div className="absolute z-10 h-6 w-6 rounded-full border-2 border-white bg-pine-900 shadow-sm" />
    </div>
  );
}

export default function MealDecision({open, matchingPlaces, catalogLoading, onClose, seedCandidates}: {
  open: boolean;
  matchingPlaces: readonly Shop[];
  catalogLoading: boolean;
  onClose: () => void;
  seedCandidates?: readonly MealCandidate[];
}) {
  const t = useTranslations('MealDecision');
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'solo' | 'group'>('solo');
  const [name, setName] = useState('');
  const [candidates, setCandidates] = useState<MealCandidate[]>([]);
  const [ballots, setBallots] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [animateWheel, setAnimateWheel] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const active = candidates.filter(candidate => !candidate.vetoed);
  const activeIndexes = new Map(active.map((candidate, index) => [candidate.id, index]));
  const result = active.find(candidate => candidate.id === resultId);
  const counts = countMealVotes(ballots);
  const canDecideByVotes = active.some(candidate => (counts.get(candidate.id) ?? 0) > 0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open || !seedCandidates?.length) return;
    setCandidates(previous => {
      const byId = new Map(previous.map(item => [item.id, item]));
      let changed = false;
      for (const candidate of seedCandidates) {
        if (!byId.has(candidate.id)) {
          byId.set(candidate.id, candidate);
          changed = true;
        }
      }
      return changed ? [...byId.values()] : previous;
    });
  }, [open, seedCandidates]);

  function updateCandidates(next: MealCandidate[]) {
    setCandidates(next);
    setResultId(null);
    setAnimateWheel(false);
    setRotation(0);
  }

  function addCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim().replace(/\s+/g, ' ');
    if (!displayName) return;
    const id = `manual:${displayName.normalize('NFKC').toLowerCase()}`;
    if (candidates.some(candidate => candidate.id === id)) {
      setDuplicate(true);
      return;
    }
    updateCandidates([...candidates, {id, name: displayName}]);
    setDuplicate(false);
    setName('');
  }

  function importCandidates() {
    const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
    for (const place of matchingPlaces) {
      const id = `place:${place.id}`;
      if (byId.has(id) || !matchesLaunchCategory(place, 'food')) continue;
      byId.set(id, {id, placeId: place.id, name: place.name, address: place.address});
    }
    if (byId.size !== candidates.length) updateCandidates([...byId.values()]);
  }

  function decide(method: 'wheel' | 'draw' | 'vote') {
    const winner = chooseMealCandidate(candidates, method === 'vote' ? ballots : []);
    if (!winner) return;
    setResultId(winner.id);
    const index = activeIndexes.get(winner.id);
    if (mode === 'solo' && index !== undefined) {
      setAnimateWheel(method === 'wheel');
      setRotation(previous => mealWheelRotation(previous, index, active.length));
    }
  }

  return (
    <dialog ref={dialog} id="meal-decision" aria-labelledby="meal-decision-title"
      onCancel={(event) => {event.preventDefault(); onClose();}}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-slate-950/40"
    >
      <header className="flex items-center justify-between gap-4 bg-pine-900 px-4 py-4 text-white sm:px-6">
        <h2 id="meal-decision-title" className="flex items-center gap-2 text-lg font-semibold">
          <Dices size={21} aria-hidden />{t('title')}
        </h2>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/15">
          <X size={20} aria-hidden />
        </button>
      </header>

      <div className="space-y-4 p-4 sm:px-6">
        <div className="grid grid-cols-2 rounded-xl border border-line bg-stone-50 p-1">
          {(['solo', 'group'] as const).map(option => (
            <button key={option} type="button" aria-pressed={mode === option}
              className="min-h-10 rounded-lg px-2 text-sm font-medium aria-pressed:bg-white aria-pressed:text-pine-800 aria-pressed:shadow-sm"
              onClick={() => {setMode(option); setResultId(null);}}>{t(option)}</button>
          ))}
        </div>

        <form onSubmit={addCandidate}>
          <label htmlFor="meal-decision-candidate" className="text-sm font-medium">{t('candidate')}</label>
          <div className="mt-1 flex gap-2">
            <input id="meal-decision-candidate" value={name} maxLength={80} onChange={(event) => {setName(event.target.value); setDuplicate(false);}}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm" />
            <button type="submit" disabled={!name.trim()} className="min-h-10 rounded-lg bg-pine-800 px-4 text-sm text-white disabled:opacity-50">{t('add')}</button>
          </div>
          {duplicate && <p className="mt-1 text-xs text-amber-800" role="status">{t('duplicate')}</p>}
        </form>

        <button type="button" onClick={importCandidates}
          disabled={catalogLoading || !matchingPlaces.some(place => matchesLaunchCategory(place, 'food'))}
          className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium text-pine-800 hover:bg-pine-50 disabled:opacity-50">
          {t('import')}
        </button>

        {candidates.length > 0 && (
          <ul aria-label={t('candidateList')} className="max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-line">
            {candidates.map(candidate => {
              const index = activeIndexes.get(candidate.id);
              return (
                <li key={candidate.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                  {index !== undefined && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: sectorColor(index)}} aria-hidden />}
                  <div className="min-w-24 grow basis-24 break-words text-sm font-medium">
                    {candidate.name}
                    {candidate.address && <div className="text-xs font-normal text-muted">{candidate.address}</div>}
                  </div>
                  {mode === 'group' && <>
                    <button type="button" disabled={candidate.vetoed} aria-label={t('voteFor', {name: candidate.name})}
                      className="min-h-9 rounded-md px-2 text-sm text-pine-800 hover:bg-pine-50 disabled:opacity-50"
                      onClick={() => {setBallots(previous => [...previous, candidate.id]); setResultId(null);}}>
                      {t('vote')} · {counts.get(candidate.id) ?? 0}
                    </button>
                    <button type="button" aria-pressed={Boolean(candidate.vetoed)} aria-label={t(candidate.vetoed ? 'restoreName' : 'vetoName', {name: candidate.name})}
                      className="min-h-9 rounded-md px-2 text-sm hover:bg-amber-50 aria-pressed:bg-amber-50 aria-pressed:text-amber-900"
                      onClick={() => updateCandidates(candidates.map(item => item.id === candidate.id ? {...item, vetoed: !item.vetoed} : item))}>
                      {t(candidate.vetoed ? 'restore' : 'veto')}
                    </button>
                  </>}
                  <button type="button" aria-label={t('remove', {name: candidate.name})}
                    className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-stone-100"
                    onClick={() => {
                      setBallots(previous => previous.filter(id => id !== candidate.id));
                      updateCandidates(candidates.filter(item => item.id !== candidate.id));
                    }}><X size={16} aria-hidden /></button>
                </li>
              );
            })}
          </ul>
        )}

        <section className="space-y-3 rounded-xl border border-line bg-stone-50 p-3 sm:p-4">
          {mode === 'solo' && active.length > 0 && (
            <WheelGraphic candidates={active} rotation={rotation} animate={animateWheel} />
          )}
          {mode === 'group' && <p className="text-xs leading-5 text-muted">{t('groupHint')}</p>}
          {!active.length && <p className="text-sm text-muted">{t('empty')}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!active.length} onClick={() => decide('draw')}
              className="min-h-10 rounded-lg bg-pine-800 px-3 text-sm font-medium text-white disabled:opacity-50">{t('draw')}</button>
            {mode === 'solo' ? (
              <button type="button" disabled={!active.length} onClick={() => decide('wheel')}
                className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm disabled:opacity-50">{t('spin')}</button>
            ) : <>
              <button type="button" disabled={!canDecideByVotes} onClick={() => decide('vote')}
                className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm disabled:opacity-50">{t('voteResult')}</button>
              <button type="button" disabled={!ballots.length}
                onClick={() => {setBallots(previous => previous.slice(0, -1)); setResultId(null);}}
                className="min-h-10 rounded-lg px-2 text-sm text-pine-800 disabled:opacity-50">{t('undoVote')}</button>
            </>}
          </div>
          <div role="status" className={result ? 'rounded-lg border border-pine-100 bg-white px-3 py-2' : undefined}>
            {result && <>
              <p className="break-words text-base font-semibold text-pine-900">{t('result', {name: result.name})}</p>
              {result.placeId && <Link href={`/shop/${result.placeId}`} className="inline-flex min-h-9 items-center text-sm text-pine-700 underline">
                {t('details')}
              </Link>}
            </>}
          </div>
        </section>
      </div>
    </dialog>
  );
}
