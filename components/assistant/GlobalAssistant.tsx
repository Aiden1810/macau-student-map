'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {Sparkles} from 'lucide-react';
import {useLocale} from 'next-intl';
import {usePathname} from '@/i18n/navigation';
import MealDecision from '@/components/MealDecision';
import {assistantCopy} from '@/lib/assistant/copy';
import {assistantPagePlaceId} from '@/lib/assistant/chat';
import type {AssistantPlace} from '@/lib/assistant/contracts';
import type {MealCandidate} from '@/lib/meal-decision/draw';
import FloatingPlaceAssistant from './FloatingPlaceAssistant';

const AssistantPanelContext = createContext<{open: boolean; toggle: () => void} | null>(null);

export function useAssistantPanel() {
  const panel = useContext(AssistantPanelContext);
  if (!panel) throw new Error('Assistant panel provider is unavailable');
  return panel;
}

export default function GlobalAssistant({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const locale = useLocale();
  const enabled = !/^\/admin(?:\/|$|-login$)/.test(pathname);
  const [panel, setPanel] = useState({open: false, hasOpened: false});
  const [wheelCandidates, setWheelCandidates] = useState<MealCandidate[]>([]);
  const [wheelOpen, setWheelOpen] = useState(false);
  const toggle = useCallback(() => setPanel(previous => ({open: !previous.open, hasOpened: true})), []);
  const close = useCallback(() => setPanel(previous => previous.open ? {...previous, open: false} : previous), []);
  const handleSendToWheel = useCallback((places: AssistantPlace[]) => {
    setWheelCandidates(places.map(place => {
      const placeId = place.catalogId ?? (place.source === 'amap' ? undefined : place.id);
      return {
        id: placeId ? `place:${placeId}` : `assistant:${place.id}`,
        placeId,
        name: place.name,
        address: place.address || undefined
      };
    }));
    close();
    setWheelOpen(true);
  }, [close]);

  useEffect(() => {
    if (!enabled) close();
    if (pathname !== '/') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('assistant') !== 'open') return;
    setPanel({open: true, hasOpened: true});
    params.delete('assistant');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [close, enabled, pathname]);

  const open = enabled && panel.open;
  const context = useMemo(() => ({open, toggle}), [open, toggle]);

  return (
    <AssistantPanelContext.Provider value={context}>
      {children}
      {enabled && pathname !== '/' && <button type="button" aria-haspopup="dialog" aria-expanded={open}
        aria-controls="home-ai-dialog" onClick={toggle}
        className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-4 z-[75] inline-flex min-h-11 items-center gap-2 rounded-xl bg-pine-800 px-4 text-sm font-semibold text-white shadow-md hover:bg-pine-900">
        <Sparkles size={16} aria-hidden />{assistantCopy(locale).nav}
      </button>}
      <FloatingPlaceAssistant open={open} hasOpened={panel.hasOpened}
        onClose={close} pagePlaceId={assistantPagePlaceId(pathname)} onSendToWheel={handleSendToWheel} />
      {wheelOpen && (
        <MealDecision
          open={wheelOpen}
          matchingPlaces={[]}
          catalogLoading={false}
          seedCandidates={wheelCandidates}
          onClose={() => setWheelOpen(false)}
        />
      )}
    </AssistantPanelContext.Provider>
  );
}
