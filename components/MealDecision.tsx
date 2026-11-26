'use client';

import {useEffect, useRef, useState, type CSSProperties, type FormEvent} from 'react';
import {ArrowUpRight, Dices, RotateCw, Sparkles, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {matchesLaunchCategory} from '@/lib/domain/place-types';
import {chooseMealCandidate, countMealVotes, mealWheelRotation, type MealCandidate} from '@/lib/meal-decision/draw';
import type {Shop} from '@/types/shop';

const WHEEL_PALETTE = [
  {fill: '#1b5e3c', text: '#ffffff'},
  {fill: '#edf3ee', text: '#16422c'},
  {fill: '#2e7850', text: '#ffffff'},
  {fill: '#f5e7c4', text: '#5c4108'},
  {fill: '#41755f', text: '#ffffff'},
  {fill: '#dcece2', text: '#18442f'},
  {fill: '#c98842', text: '#ffffff'},
  {fill: '#f2f5f0', text: '#244636'}
] as const;

const CONFETTI_PIECES = [
  {tx: '-82px', ty: '-74px', rot: '-140deg', color: '#1b5e3c'},
  {tx: '86px', ty: '-68px', rot: '130deg', color: '#e9c46a'},
  {tx: '-104px', ty: '-10px', rot: '-90deg', color: '#c98842'},
  {tx: '106px', ty: '12px', rot: '110deg', color: '#2e7850'},
  {tx: '-68px', ty: '76px', rot: '-160deg', color: '#e9c46a'},
  {tx: '72px', ty: '80px', rot: '150deg', color: '#1b5e3c'},
  {tx: '-22px', ty: '-102px', rot: '-60deg', color: '#41755f'},
  {tx: '26px', ty: '-98px', rot: '75deg', color: '#d4a24c'},
  {tx: '-96px', ty: '42px', rot: '-120deg', color: '#8fb9a0'},
  {tx: '94px', ty: '-36px', rot: '95deg', color: '#1b5e3c'},
  {tx: '0px', ty: '104px', rot: '180deg', color: '#e9c46a'},
  {tx: '-44px', ty: '-92px', rot: '-110deg', color: '#c98842'}
] as const;

const SPIN_DURATION_MS = 3600;
const easeOutQuintic = (t: number) => 1 - Math.pow(1 - t, 4.6);

const sectorStyle = (index: number) => WHEEL_PALETTE[index % WHEEL_PALETTE.length];
const sectorColor = (index: number) => sectorStyle(index).fill;
const formatWheelLabel = (name: string, count: number) => {
  const clean = name.replace(/[（(][^（）()]*[）)]$/, '').trim() || name;
  const maxLen = count <= 4 ? 9 : count <= 8 ? 8 : 6;
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
};

function sectorIndexAtPointer(angleDeg: number, count: number) {
  if (count <= 0) return -1;
  const normalized = ((360 - (angleDeg % 360)) + 360) % 360;
  return Math.floor((normalized / 360) * count) % count;
}

type ChoiceType = 'restaurant' | 'cuisine';
type ChoicePool = {candidates: MealCandidate[]; ballots: string[]};

function MealWheel({
  wheelId,
  candidates,
  rotation,
  spinning,
  pointerKick,
  tickStep,
  winnerId,
  celebrateKey,
  liveLabel,
  spinLabel,
  onSpin
}: {
  wheelId: string;
  candidates: readonly MealCandidate[];
  rotation: number;
  spinning: boolean;
  pointerKick: number;
  tickStep: number;
  winnerId: string | null;
  celebrateKey: number;
  liveLabel: string | null;
  spinLabel: string;
  onSpin: () => void;
}) {
  const count = candidates.length;
  const depthGradientId = `${wheelId}-depth`;
  const cx = 140;
  const cy = 140;
  const bezelR = 132;
  const wheelR = 120;
  const pegR = 115;

  const sectorPath = (index: number) => {
    const startAngle = ((index * 360) / count - 90) * (Math.PI / 180);
    const endAngle = (((index + 1) * 360) / count - 90) * (Math.PI / 180);
    const x1 = cx + wheelR * Math.cos(startAngle);
    const y1 = cy + wheelR * Math.sin(startAngle);
    const x2 = cx + wheelR * Math.cos(endAngle);
    const y2 = cy + wheelR * Math.sin(endAngle);
    const largeArc = 360 / count > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${wheelR} ${wheelR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Live ticker pill showing what is currently under the pointer */}
      <div className="mb-3 flex h-7 items-center justify-center">
        {liveLabel && (
          <span className={`inline-flex max-w-[230px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            spinning
              ? 'border-pine-200 bg-pine-50 text-pine-900'
              : 'border-[#e6c982] bg-[#fdf8ea] text-[#5c4108]'
          }`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${spinning ? 'animate-pulse bg-pine-700' : 'bg-[#c98842]'}`} aria-hidden />
            <span className="truncate">{liveLabel}</span>
          </span>
        )}
      </div>

      <div className="relative mx-auto flex h-[268px] w-[268px] items-center justify-center select-none sm:h-[280px] sm:w-[280px]">
        {/* Ambient soft glow */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-4 rounded-full bg-pine-700/12 blur-2xl transition-opacity duration-500 ${spinning ? 'opacity-100' : 'opacity-45'}`}
        />

        {/* Celebration confetti burst on landing */}
        {celebrateKey > 0 && !spinning && (
          <div key={celebrateKey} aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-visible motion-reduce:hidden">
            {CONFETTI_PIECES.map((piece, idx) => (
              <span
                key={idx}
                className="meal-wheel-confetti-piece absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-[2px]"
                style={{
                  backgroundColor: piece.color,
                  '--tx': piece.tx,
                  '--ty': piece.ty,
                  '--rot': piece.rot
                } as CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Top mechanical flapper pointer with peg-kick tilt */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-2.5 z-20 origin-[50%_10px] drop-shadow-[0_4px_7px_rgba(16,42,29,0.3)]"
          style={{
            transform: `rotate(${pointerKick}deg)`,
            transition: pointerKick !== 0
              ? 'transform 45ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              : 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
            <path
              d="M16 38L5.2 15.8C3.2 11.4 6.2 2.5 16 2.5C25.8 2.5 28.8 11.4 26.8 15.8L16 38Z"
              fill="#123a25"
              stroke="#ffffff"
              strokeWidth="2.4"
            />
            <circle cx="16" cy="12.5" r="4" fill="#e9c46a" />
            <circle cx="16" cy="12.5" r="1.6" fill="#123a25" />
          </svg>
        </div>

        {/* Outer metallic pine bezel */}
        <div className="relative h-full w-full rounded-full bg-gradient-to-b from-[#1f5c3b] via-[#15412a] to-[#0d2b1b] p-[12px] shadow-[0_18px_40px_rgba(14,42,27,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.24)]">
          {/* Alternating chasing marquee lights on bezel */}
          <svg viewBox="0 0 280 280" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
            {Array.from({length: 16}).map((_, i) => {
              const angle = (i * 22.5 - 90) * (Math.PI / 180);
              const dotX = cx + bezelR * Math.cos(angle);
              const dotY = cy + bezelR * Math.sin(angle);
              const lit = spinning ? (i + tickStep) % 2 === 0 : i % 2 === 0;
              return (
                <circle
                  key={i}
                  cx={dotX}
                  cy={dotY}
                  r={lit ? 2.9 : 2}
                  fill={lit ? '#f2d07b' : 'rgba(255,255,255,0.34)'}
                />
              );
            })}
          </svg>

          {/* Rotating wheel body driven by rAF */}
          <div
            className="h-full w-full overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.9)] will-change-transform"
            style={{transform: `rotate(${rotation}deg)`}}
          >
            <svg viewBox="0 0 280 280" aria-hidden className="h-full w-full">
              <defs>
                <radialGradient id={depthGradientId} cx="50%" cy="50%" r="50%">
                  <stop offset="22%" stopColor="rgba(0,0,0,0.08)" />
                  <stop offset="68%" stopColor="rgba(255,255,255,0.04)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.09)" />
                </radialGradient>
              </defs>

              {count === 1 ? (
                <g>
                  <circle cx={cx} cy={cy} r={wheelR} fill={sectorStyle(0).fill} />
                  <text
                    x={cx}
                    y={cy - 44}
                    textAnchor="middle"
                    fill={sectorStyle(0).text}
                    fontSize="15"
                    fontWeight="600"
                  >
                    {formatWheelLabel(candidates[0].name, 1)}
                  </text>
                </g>
              ) : (
                <>
                  {candidates.map((candidate, index) => {
                    const {fill, text} = sectorStyle(index);
                    const midDeg = ((index + 0.5) * 360) / count;
                    const isWinner = !spinning && winnerId === candidate.id;
                    const fontSize = count <= 4 ? 13 : count <= 6 ? 11.5 : count <= 9 ? 10 : 9;
                    return (
                      <g key={candidate.id}>
                        <path
                          d={sectorPath(index)}
                          fill={fill}
                          stroke="#ffffff"
                          strokeWidth="1.8"
                          opacity={winnerId && !spinning && !isWinner ? 0.72 : 1}
                        />
                        {isWinner && (
                          <path
                            d={sectorPath(index)}
                            fill="rgba(233,196,106,0.24)"
                            stroke="#e9c46a"
                            strokeWidth="2.6"
                          />
                        )}
                        {/* Radial text along sector bisector (inspired by CrazyTim/spin-wheel) */}
                        {count <= 12 && (
                          <text
                            x={cx + 76}
                            y={cy}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={text}
                            fontSize={fontSize}
                            fontWeight="600"
                            transform={`rotate(${midDeg - 90} ${cx} ${cy})`}
                          >
                            {formatWheelLabel(candidate.name, count)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Soft depth overlay */}
                  <circle cx={cx} cy={cy} r={wheelR} fill={`url(#${depthGradientId})`} pointerEvents="none" />

                  {/* Brass pegs on every sector boundary (hidden when too dense) */}
                  {count <= 24 && candidates.map((candidate, index) => {
                    const angle = ((index * 360) / count - 90) * (Math.PI / 180);
                    const px = cx + pegR * Math.cos(angle);
                    const py = cy + pegR * Math.sin(angle);
                    return (
                      <circle
                        key={`peg-${candidate.id}`}
                        cx={px}
                        cy={py}
                        r="3"
                        fill="#f2d07b"
                        stroke="#143d28"
                        strokeWidth="1"
                      />
                    );
                  })}
                </>
              )}
            </svg>
          </div>

          {/* Center interactive spin hub */}
          <button
            type="button"
            onClick={onSpin}
            disabled={spinning || count === 0}
            aria-label={spinLabel}
            title={spinLabel}
            className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[4px] border-white bg-gradient-to-b from-pine-700 via-pine-800 to-pine-950 text-white shadow-[0_8px_20px_rgba(14,42,27,0.38),inset_0_1px_1px_rgba(255,255,255,0.3)] transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 focus-visible:ring-offset-2 disabled:cursor-default disabled:hover:scale-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e9c46a]/45">
              <RotateCw size={20} aria-hidden className={spinning ? 'animate-spin motion-reduce:animate-none' : ''} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MealDecision({open, matchingPlaces, catalogLoading, onClose, dialogId = 'meal-decision'}: {
  open: boolean;
  matchingPlaces: readonly Shop[];
  catalogLoading: boolean;
  onClose: () => void;
  dialogId?: string;
}) {
  const t = useTranslations('MealDecision');
  const dialog = useRef<HTMLDialogElement>(null);
  const rafRef = useRef<number | null>(null);
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationRef = useRef(0);
  const [mode, setMode] = useState<'solo' | 'group'>('solo');
  const [choiceType, setChoiceType] = useState<ChoiceType>('restaurant');
  const [name, setName] = useState('');
  const [pools, setPools] = useState<Record<ChoiceType, ChoicePool>>({
    restaurant: {candidates: [], ballots: []},
    cuisine: {candidates: [], ballots: []}
  });
  const {candidates, ballots} = pools[choiceType];
  const [resultId, setResultId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pointerKick, setPointerKick] = useState(0);
  const [tickStep, setTickStep] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [duplicate, setDuplicate] = useState(false);
  const active = candidates.filter(candidate => !candidate.vetoed);
  const activeIndexes = new Map(active.map((candidate, index) => [candidate.id, index]));
  const result = spinning ? undefined : active.find(candidate => candidate.id === resultId);
  const counts = countMealVotes(ballots);
  const canDecideByVotes = active.some(candidate => (counts.get(candidate.id) ?? 0) > 0);

  const currentPointerIndex = sectorIndexAtPointer(rotation, active.length);
  const liveLabel = spinning
    ? (currentPointerIndex >= 0 ? active[currentPointerIndex]?.name ?? null : null)
    : (result?.name ?? null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open) {
      stopAnimation();
      setSpinning(false);
      if (element.open) element.close();
    }
  }, [open]);

  function stopAnimation() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (kickTimerRef.current) {
      clearTimeout(kickTimerRef.current);
      kickTimerRef.current = null;
    }
    setPointerKick(0);
  }

  useEffect(() => () => stopAnimation(), []);

  function resetResult() {
    stopAnimation();
    setSpinning(false);
    setResultId(null);
    rotationRef.current = 0;
    setRotation(0);
    setCelebrateKey(0);
  }

  function updateCandidates(next: MealCandidate[]) {
    setPools(previous => ({...previous, [choiceType]: {...previous[choiceType], candidates: next}}));
    resetResult();
  }

  function setBallots(update: (previous: string[]) => string[]) {
    setPools(previous => ({...previous, [choiceType]: {
      ...previous[choiceType], ballots: update(previous[choiceType].ballots)
    }}));
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

  function triggerPointerBounce(intensity: number) {
    setPointerKick(-Math.round(14 + intensity * 14));
    setTickStep(previous => previous + 1);
    if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
    kickTimerRef.current = setTimeout(() => setPointerKick(0), 65);
  }

  function decide(method: 'wheel' | 'draw' | 'vote') {
    if (spinning) return;
    const winner = chooseMealCandidate(candidates, method === 'vote' ? ballots : []);
    if (!winner) return;
    const index = activeIndexes.get(winner.id);
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (mode === 'solo' && method === 'wheel' && index !== undefined && !reducedMotion) {
      stopAnimation();
      const startAngle = rotationRef.current;
      // Add 3 extra full turns (1080 deg) over mealWheelRotation for a realistic 5-turn spin.
      const targetAngle = mealWheelRotation(startAngle, index, active.length) + 1080;
      const totalDelta = targetAngle - startAngle;
      const sectorCount = active.length;
      let lastSector = sectorIndexAtPointer(startAngle, sectorCount);
      const startTime = performance.now();

      setResultId(null);
      setSpinning(true);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);
        const eased = easeOutQuintic(progress);
        const nextAngle = startAngle + totalDelta * eased;

        rotationRef.current = nextAngle;
        setRotation(nextAngle);

        const currentSector = sectorIndexAtPointer(nextAngle, sectorCount);
        if (currentSector !== lastSector) {
          lastSector = currentSector;
          triggerPointerBounce(1 - progress);
        }

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          rotationRef.current = targetAngle;
          setRotation(targetAngle);
          setPointerKick(0);
          setSpinning(false);
          setResultId(winner.id);
          setCelebrateKey(previous => previous + 1);
        }
      };

      rafRef.current = requestAnimationFrame(step);
      return;
    }

    stopAnimation();
    setSpinning(false);
    setResultId(winner.id);
    if (mode === 'solo' && index !== undefined) {
      const nextAngle = mealWheelRotation(rotationRef.current, index, active.length);
      rotationRef.current = nextAngle;
      setRotation(nextAngle);
    }
  }

  return (
    <dialog ref={dialog} id={dialogId} aria-labelledby={`${dialogId}-title`}
      onCancel={(event) => {event.preventDefault(); onClose();}}
      className="fixed inset-0 m-auto max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-auto rounded-[24px] border border-line bg-canvas p-0 text-ink shadow-[0_24px_64px_rgba(16,42,29,0.22)] backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
    >
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-gradient-to-r from-pine-900 to-pine-800 px-5 py-4 text-white sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <Dices size={19} aria-hidden />
          </span>
          <h2 id={`${dialogId}-title`} className="text-lg font-semibold tracking-tight">
            {t('title')}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
          <X size={20} aria-hidden />
        </button>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2">
          <div role="group" aria-label={t('choiceType')} className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgba(25,61,50,0.03)]">
            {(['restaurant', 'cuisine'] as const).map(option => (
              <button key={option} type="button" aria-pressed={choiceType === option}
                className="min-h-10 rounded-xl px-2 text-sm font-semibold text-muted transition hover:text-pine-800 aria-pressed:bg-pine-800 aria-pressed:text-white aria-pressed:shadow-sm"
                onClick={() => {
                  if (choiceType === option) return;
                  setChoiceType(option);
                  setName('');
                  setDuplicate(false);
                  resetResult();
                }}>{t(option)}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1 shadow-[0_1px_2px_rgba(25,61,50,0.03)]">
            {(['solo', 'group'] as const).map(option => (
              <button key={option} type="button" aria-pressed={mode === option}
                className="min-h-10 rounded-xl px-2 text-sm font-semibold text-muted transition hover:text-pine-800 aria-pressed:bg-pine-50 aria-pressed:text-pine-900 aria-pressed:ring-1 aria-pressed:ring-pine-200"
                onClick={() => {setMode(option); resetResult();}}>{t(option)}</button>
            ))}
          </div>
        </div>

        <section className="rounded-[20px] border border-line bg-white p-4 shadow-[0_2px_10px_rgba(25,61,50,0.04)] sm:p-5">
          {mode === 'solo' && active.length > 0 && (
            <div className="pb-2">
              <MealWheel
                wheelId={dialogId}
                candidates={active}
                rotation={rotation}
                spinning={spinning}
                pointerKick={pointerKick}
                tickStep={tickStep}
                winnerId={result?.id ?? null}
                celebrateKey={celebrateKey}
                liveLabel={liveLabel}
                spinLabel={t('spin')}
                onSpin={() => decide('wheel')}
              />
            </div>
          )}
          {mode === 'group' && (
            <p className="rounded-xl bg-pine-50/70 px-3 py-2 text-xs leading-5 text-pine-800">{t('groupHint')}</p>
          )}
          {!active.length && (
            <div className="rounded-2xl border border-dashed border-line bg-canvas px-4 py-6 text-center">
              <p className="text-sm text-muted">{t(choiceType === 'cuisine' ? 'cuisineEmpty' : 'empty')}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {mode === 'solo' ? (
              <>
                <button type="button" disabled={!active.length || spinning} onClick={() => decide('wheel')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pine-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-pine-900 active:scale-[0.98] disabled:opacity-50">
                  <RotateCw size={16} aria-hidden className={spinning ? 'animate-spin motion-reduce:animate-none' : ''} />
                  {t('spin')}
                </button>
                <button type="button" disabled={!active.length || spinning} onClick={() => decide('draw')}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-medium text-pine-800 transition hover:bg-pine-50 active:scale-[0.98] disabled:opacity-50">
                  <Dices size={16} aria-hidden />
                  {t('draw')}
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={!canDecideByVotes} onClick={() => decide('vote')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pine-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-pine-900 disabled:opacity-50">
                  {t('voteResult')}
                </button>
                <button type="button" disabled={!active.length} onClick={() => decide('draw')}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-medium text-pine-800 transition hover:bg-pine-50 disabled:opacity-50">
                  <Dices size={16} aria-hidden />
                  {t('draw')}
                </button>
                <button type="button" disabled={!ballots.length}
                  onClick={() => {setBallots(previous => previous.slice(0, -1)); setResultId(null);}}
                  className="min-h-11 rounded-xl px-3 text-sm font-medium text-pine-800 hover:bg-pine-50 disabled:opacity-50">
                  {t('undoVote')}
                </button>
              </>
            )}
          </div>

          <div role="status" className={result ? 'mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine-200 bg-gradient-to-r from-pine-50 to-[#faf6ea] px-4 py-3 shadow-sm' : undefined}>
            {result && <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[#f3d483]">
                  <Sparkles size={15} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold text-pine-950">{t('result', {name: result.name})}</p>
                  {result.address && <p className="mt-0.5 truncate text-xs text-muted">{result.address}</p>}
                </div>
              </div>
              {result.placeId && (
                <Link href={`/shop/${result.placeId}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-white px-3.5 text-sm font-semibold text-pine-800 ring-1 ring-pine-200 transition hover:bg-pine-800 hover:text-white">
                  {t('details')}
                  <ArrowUpRight size={15} aria-hidden />
                </Link>
              )}
            </>}
          </div>
        </section>

        <section className="space-y-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_1px_4px_rgba(25,61,50,0.03)]">
          <form onSubmit={addCandidate}>
            <label htmlFor={`${dialogId}-candidate`} className="text-sm font-semibold text-ink">
              {t(choiceType === 'cuisine' ? 'cuisineCandidate' : 'candidate')}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input id={`${dialogId}-candidate`} value={name} maxLength={80} onChange={(event) => {setName(event.target.value); setDuplicate(false);}}
                placeholder={choiceType === 'cuisine' ? t('cuisineExamples') : undefined}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3.5 text-sm outline-none transition focus:border-pine-700 focus:bg-white focus:ring-2 focus:ring-pine-700/15" />
              <button type="submit" disabled={!name.trim() || spinning} className="min-h-11 rounded-xl bg-pine-800 px-4 text-sm font-semibold text-white transition hover:bg-pine-900 disabled:opacity-50">{t('add')}</button>
            </div>
            {duplicate && <p className="mt-1.5 text-xs text-amber-800" role="status">{t('duplicate')}</p>}
          </form>

          {choiceType === 'restaurant' && (
            <button type="button" onClick={importCandidates}
              disabled={spinning || catalogLoading || !matchingPlaces.some(place => matchesLaunchCategory(place, 'food'))}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-pine-200 bg-pine-50/60 px-3.5 text-sm font-medium text-pine-800 transition hover:bg-pine-50 disabled:opacity-50">
              {t('import')}
            </button>
          )}

          {candidates.length > 0 && (
            <ul aria-label={t(choiceType === 'cuisine' ? 'cuisineList' : 'candidateList')} className="max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-2xl border border-line bg-canvas/50">
              {candidates.map(candidate => {
                const index = activeIndexes.get(candidate.id);
                const isWinner = result?.id === candidate.id;
                return (
                  <li key={candidate.id} className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2.5 transition-colors ${isWinner ? 'bg-pine-50' : ''}`}>
                    {index !== undefined && (
                      <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm" style={{backgroundColor: sectorColor(index)}} aria-hidden />
                    )}
                    <div className={`min-w-24 grow basis-24 break-words text-sm font-medium ${candidate.vetoed ? 'text-muted line-through' : 'text-ink'}`}>
                      {candidate.name}
                      {candidate.address && <div className="text-xs font-normal text-muted">{candidate.address}</div>}
                    </div>
                    {mode === 'group' && <>
                      <button type="button" disabled={candidate.vetoed} aria-label={t('voteFor', {name: candidate.name})}
                        className="min-h-9 rounded-lg px-2.5 text-sm font-medium text-pine-800 transition hover:bg-pine-50 disabled:opacity-50"
                        onClick={() => {setBallots(previous => [...previous, candidate.id]); setResultId(null);}}>
                        {t('vote')} · {counts.get(candidate.id) ?? 0}
                      </button>
                      <button type="button" aria-pressed={Boolean(candidate.vetoed)} aria-label={t(candidate.vetoed ? 'restoreName' : 'vetoName', {name: candidate.name})}
                        className="min-h-9 rounded-lg px-2.5 text-sm transition hover:bg-amber-50 aria-pressed:bg-amber-50 aria-pressed:text-amber-900"
                        onClick={() => updateCandidates(candidates.map(item => item.id === candidate.id ? {...item, vetoed: !item.vetoed} : item))}>
                        {t(candidate.vetoed ? 'restore' : 'veto')}
                      </button>
                    </>}
                    <button type="button" aria-label={t('remove', {name: candidate.name})}
                      disabled={spinning}
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-stone-200/70 disabled:opacity-40"
                      onClick={() => {
                        setBallots(previous => previous.filter(id => id !== candidate.id));
                        updateCandidates(candidates.filter(item => item.id !== candidate.id));
                      }}><X size={16} aria-hidden /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
