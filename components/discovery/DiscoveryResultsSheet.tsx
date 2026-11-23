'use client';

import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {ChevronDown, List} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {getSheetHeights, resolveSheetDrag, type MobileSheetSnap} from '@/lib/ui/mobile-sheet';

export default function DiscoveryResultsSheet({children, snap, onSnap, top, loading, count}: {
  children: ReactNode; snap: MobileSheetSnap; onSnap: (snap: MobileSheetSnap) => void;
  top: number; loading: boolean; count: number
}) {
  const t = useTranslations('Home');
  const discovery = useTranslations('Discovery');
  const filters = useTranslations('Filters');
  const id = useId();
  const restore = useRef<HTMLButtonElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const drag = useRef<{y: number; startHeight: number; full: number} | null>(null);
  const skipClick = useRef(false);
  const [height, setHeight] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const hidden = mobile && snap === 'hidden';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => {setMobile(media.matches); drag.current = null; setHeight(null);};
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  function toggle(next: MobileSheetSnap) {
    onSnap(next);
    requestAnimationFrame(() => (next === 'hidden' ? restore.current : handle.current)?.focus({preventScroll: true}));
  }

  const fullHeight = 'max(0px,calc(100dvh - ' + (top + 4) + 'px))';
  return <>
    {hidden && <button ref={restore} type="button" aria-expanded={false} aria-controls={id}
      onClick={() => toggle('collapsed')}
      className="fixed bottom-[max(env(safe-area-inset-bottom),12px)] left-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink shadow-lg focus-visible:ring-2 focus-visible:ring-pine-700 md:hidden">
      <List size={19} aria-hidden="true" />{t('mobile.placesTitle')}
    </button>}
    <section id={id} aria-label={discovery('list')} aria-busy={loading} aria-hidden={hidden || undefined} inert={hidden}
      className={'fixed inset-x-0 bottom-0 z-40 flex h-[min(320px,44dvh)] min-h-0 min-w-0 flex-col rounded-t-[28px] border-t border-line bg-canvas px-4 shadow-[0_-4px_24px_#193d320c] md:relative md:inset-auto md:z-auto md:col-span-4 md:col-start-1 md:row-start-1 md:h-full md:rounded-2xl md:border md:bg-white md:p-3 md:shadow-sm ' +
        (hidden ? 'invisible translate-y-full md:visible md:translate-y-0' : '') +
        (height === null ? ' transition-[height,transform] duration-300 motion-reduce:transition-none md:transition-none' : '')}
      style={mobile ? {height: height ?? (snap === 'full' ? fullHeight : 'min(320px,' + fullHeight + ')'), maxHeight: fullHeight} : undefined}>
      <div className="relative h-11 shrink-0 md:hidden">
        <button ref={handle} type="button" aria-label={t('mobile.expandCollapseDrawerAria')} aria-expanded={snap === 'full'}
          className="flex h-11 w-full touch-none cursor-grab items-center justify-center rounded-t-2xl focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine-700"
          onClick={() => {
            if (skipClick.current) {skipClick.current = false; return;}
            onSnap(snap === 'full' ? 'collapsed' : 'full');
          }}
          onPointerDown={event => {
            if (!event.isPrimary) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            skipClick.current = false;
            const sizes = getSheetHeights(window.innerHeight, top);
            drag.current = {y: event.clientY, startHeight: sizes[snap], full: sizes.full};
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (start && event.isPrimary) setHeight(Math.max(0, Math.min(start.full, start.startHeight + start.y - event.clientY)));
          }}
          onPointerUp={event => {
            const start = drag.current;
            if (!start || !event.isPrimary) return;
            const delta = start.y - event.clientY;
            const next = resolveSheetDrag(snap, start.startHeight, delta, start.full);
            skipClick.current = Math.abs(delta) > 36;
            drag.current = null;
            setHeight(null);
            if (next === 'hidden') toggle(next);
            else onSnap(next);
          }}
          onPointerCancel={() => {drag.current = null; setHeight(null);}}>
          <span className="h-1 w-9 rounded-full bg-[#cbd3cb]" />
        </button>
        <button type="button" aria-label={t('mobile.hideList')} onClick={() => toggle('hidden')}
          className="absolute -right-1 top-0 flex h-11 w-11 items-center justify-center rounded-full text-muted focus-visible:ring-2 focus-visible:ring-pine-700">
          <ChevronDown size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="mb-2 flex shrink-0 items-baseline gap-2">
        <h2 className="text-lg font-semibold text-ink">{t('mobile.placesTitle')}</h2>
        <span className="text-xs text-muted">{filters('currentTotal', {count})}</span>
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),12px)] md:pb-0">
        {children}
      </div>
    </section>
  </>;
}
