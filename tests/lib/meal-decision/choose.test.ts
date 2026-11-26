import {expect, it} from 'vitest';
import {finishMealChoice, prepareMealChoice} from '@/lib/meal-decision/choose';
import type {AssistantIntent, AssistantOrigin, AssistantPlace, RouteSnapshot} from '@/lib/assistant/contracts';

const intent: AssistantIntent = {intent: 'recommend',
  budgetPerPerson: 40, totalBudget: null, currency: 'CNY', partySize: 2, foods: ['noodles'],
  excludedFoods: [], priority: 'balanced', transport: 'walking', maxWalkingMinutes: 15
};
const origin: AssistantOrigin = {label: 'Campus', city: '澳门', coordinates: [113.54, 22.16]};
const place = (id: string, price: number | null, longitude: number, tags = ['粉面']): AssistantPlace => ({
  id, name: id, address: 'Taipa', category: 'food', pricePerPerson: price, tags, coordinates: [longitude, 22.16]
});
const route = (candidate: AssistantPlace, durationSeconds: number): RouteSnapshot => ({
  placeId: candidate.id, origin: origin.coordinates, destination: candidate.coordinates!, queriedAt: 100, source: 'amap-js',
  taxi: {status: 'no_route'}, transit: {status: 'no_route'},
  walking: {status: 'ok', durationSeconds, distanceMeters: 750, lines: [], walkingMeters: null}
});

it('reports why candidates were excluded and keeps only confirmed matches for comparison and draw', () => {
  const near = place('fits', 35, 113.541);
  const far = place('too-far', 20, 113.542);
  const prepared = prepareMealChoice([
    near, far, place('over-budget', 41, 113.543), place('unknown-price', null, 113.544),
    place('unknown-walk', 20, 113.547), place('wrong-food', 20, 113.548, ['火锅']),
    {...place('missing-coordinate', 20, 113.549), coordinates: null}
  ], intent, origin);
  expect(prepared.candidates.map(place => place.id)).toEqual(['fits', 'too-far', 'unknown-walk']);
  const result = finishMealChoice(prepared, intent, [route(near, 900), route(far, 901)]);
  expect(result.matches.map(row => row.place.id)).toEqual(['fits']);
  expect(result.matches[0].groupTotal).toBe(70);
  expect(result.excluded).toMatchObject({over_budget: 1, unknown_price: 1, food_mismatch: 1, over_walking: 1, unknown_walking: 2});
});

it('keeps unrouted candidates out of the checked batch when the comparison limit is reached', () => {
  const candidates = Array.from({length: 5}, (_, i) => place(`cafe-${i}`, 30, 113.541 + i / 1000));
  const checked = prepareMealChoice(candidates, intent, origin);
  expect(checked.candidates).toHaveLength(4);
  expect(checked.remaining).toBe(1);
  expect(finishMealChoice(checked, intent, []).excluded.unknown_walking).toBe(4);
});

it('distinguishes provider errors and timeouts from a missing walkable route', () => {
  const candidates = [place('provider-error', 30, 113.541), place('timeout', 30, 113.542),
    place('no-route', 30, 113.543), place('fits', 30, 113.544)];
  const prepared = prepareMealChoice(candidates, intent, origin);
  const result = finishMealChoice(prepared, intent, [
    {...route(candidates[0], 600), walking: {status: 'error'}},
    {...route(candidates[1], 600), walking: {status: 'timeout'}},
    {...route(candidates[2], 600), walking: {status: 'no_route'}},
    route(candidates[3], 600)
  ]);

  expect(result.walkingRequestFailed).toBe(true);
  expect(result.excluded.unknown_walking).toBe(3);
  expect(result.matches.map(row => row.place.id)).toEqual(['fits']);
  const noRoute = finishMealChoice(prepared, intent, [{...route(candidates[2], 600), walking: {status: 'no_route'}}]);
  expect(noRoute.walkingRequestFailed).toBe(false);
});
