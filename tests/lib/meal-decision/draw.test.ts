import {describe, expect, it} from 'vitest';
import {chooseMealCandidate, mealWheelRotation, type MealCandidate} from '@/lib/meal-decision/draw';

const candidates: MealCandidate[] = [
  {id: 'a', name: 'Cafe A'},
  {id: 'b', name: 'Cafe B'},
  {id: 'c', name: 'Cafe C', vetoed: true}
];

describe('meal draw', () => {
  it('draws only non-vetoed names and handles an empty list', () => {
    expect(chooseMealCandidate(candidates, [], () => 0)?.id).toBe('a');
    expect(chooseMealCandidate(candidates, [], () => 0.99)?.id).toBe('b');
    expect(chooseMealCandidate([candidates[2]], [], () => 0)).toBeNull();
  });

  it('uses only counted votes and randomly breaks ties at the top', () => {
    expect(chooseMealCandidate(candidates, ['a', 'b', 'b', 'c', 'c', 'c'], () => 0)?.id).toBe('b');
    expect(chooseMealCandidate(candidates, ['a', 'b'], () => 0.99)?.id).toBe('b');
    expect(chooseMealCandidate(candidates, ['removed', 'c'], () => 0)?.id).toBe('a');
  });

  it('rotates forward and aligns the selected sector center with the pointer', () => {
    const first = mealWheelRotation(0, 0, 4);
    const second = mealWheelRotation(first, 2, 4);
    expect(first).toBeGreaterThanOrEqual(720);
    expect(second).toBeGreaterThanOrEqual(first + 720);
    expect((first + 45) % 360).toBe(0);
    expect((second + 225) % 360).toBe(0);
  });
});
