export type MealCandidate = {
  id: string;
  name: string;
  address?: string;
  placeId?: string;
  vetoed?: boolean;
};

export function countMealVotes(ballots: readonly string[]) {
  const counts = new Map<string, number>();
  for (const id of ballots) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

export function chooseMealCandidate(
  candidates: readonly MealCandidate[],
  ballots: readonly string[] = [],
  random = Math.random,
): MealCandidate | null {
  const active = candidates.filter(candidate => !candidate.vetoed);
  if (!active.length) return null;
  const counts = countMealVotes(ballots);
  const mostVotes = Math.max(...active.map(candidate => counts.get(candidate.id) ?? 0));
  const pool = active.filter(candidate => (counts.get(candidate.id) ?? 0) === mostVotes);
  return pool[Math.floor(random() * pool.length)];
}

export function mealWheelRotation(current: number, index: number, count: number) {
  const sectorCenter = ((index + 0.5) * 360) / count;
  const offset = (720 - sectorCenter - (current % 360)) % 360;
  return current + 720 + offset;
}
