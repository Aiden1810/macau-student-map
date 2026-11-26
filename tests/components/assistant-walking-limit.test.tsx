// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {usePlaceChat} from '@/components/assistant/usePlaceChat';
import {chatCopy} from '@/lib/assistant/chat-copy';
import type {AssistantIntent, AssistantPlace, RouteChoice} from '@/lib/assistant/contracts';
import {compareAmapRoutes} from '@/lib/amap/route-comparison';

vi.mock('@/lib/amap/route-comparison', () => ({compareAmapRoutes: vi.fn(), resolveRouteCity: () => '澳门'}));

it.each(['named', 'catalog'] as const)(
  'waits for an origin and filters %s restaurants by budget and walking time',
  async (mode) => {
  vi.mocked(compareAmapRoutes).mockClear();
  const copy = chatCopy('en');
  const intent: AssistantIntent = {
    intent: 'recommend', budgetPerPerson: 40, totalBudget: null, currency: 'CNY',
    partySize: null, foods: [], excludedFoods: [], priority: 'balanced', transport: 'either',
    maxWalkingMinutes: 15
  };
  const candidates: AssistantPlace[] = [
    {id: 'near', name: 'Cafe A', address: 'Taipa', category: 'food', pricePerPerson: 36, coordinates: [113.55, 22.16], tags: []},
    {id: 'far', name: 'Cafe B', address: 'Taipa', category: 'food', pricePerPerson: 10, coordinates: [113.56, 22.16], tags: []}
  ];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/assistant/chat'
    ? Response.json({ok: true, data: {
        mode: 'ai', understanding: {
          placeNames: mode === 'named' ? candidates.map(place => place.name) : [],
          originAction: 'keep', originQuery: null, intent
        },
        groups: mode === 'named' ? candidates.map(place => ({query: place.name, candidates: [place]})) : [],
        ...(mode === 'catalog' && {catalogCandidates: candidates})
      }})
    : Response.json({data: {available: true}})));
  vi.mocked(compareAmapRoutes).mockImplementation(async (_key, origin, places) =>
    places.map((place, index) => {
      const walking: RouteChoice = {status: 'ok', durationSeconds: index === 0 ? 900 : 901, distanceMeters: 850, lines: [], walkingMeters: null};
      return {
        placeId: place.id, origin: origin.coordinates, destination: place.coordinates!, queriedAt: Date.now(), source: 'amap-js',
        taxi: {...walking, durationSeconds: 60}, transit: {status: 'no_route'}, walking
      };
    }));

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.createElement('div'));
  let chat!: ReturnType<typeof usePlaceChat>;
  function Harness() {chat = usePlaceChat(copy); return null;}
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => chat.send(mode === 'named'
      ? 'CNY 40 per person, a 15-minute walk at most. Cafe A or Cafe B?'
      : 'CNY 40 per person, a 15-minute walk at most. Where should I eat?'));
    expect(chat.pending?.intent.maxWalkingMinutes).toBe(15);
    expect(compareAmapRoutes).not.toHaveBeenCalled();
    await act(async () => chat.chooseOrigin({placeId: 'start', name: 'Start', city: 'macau',
      fullAddress: 'Taipa', coordinates: [113.54, 22.16]}));
    expect(compareAmapRoutes).toHaveBeenCalledOnce();
    expect(chat.messages.at(-1)?.decision?.recommendedPlaceId).toBe('near');
    expect(chat.messages.at(-1)?.text).toContain('Walking limit：15');
    if (mode === 'catalog') expect(chat.messages.at(-1)?.text).toContain(copy.catalogScope);
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    vi.unstubAllGlobals();
  }
  }
);
