export type MobileSheetSnap = 'hidden' | 'collapsed' | 'full';

export function getSheetHeights(viewportHeight: number, topOffset: number) {
  const full = Math.max(0, viewportHeight - topOffset - 4);
  return {hidden: 0, collapsed: Math.min(320, full), full};
}

/** Small directional swipes move one stop; long drags may reach either edge. */
export function resolveSheetDrag(
  snap: MobileSheetSnap, startHeight: number, delta: number, fullHeight: number,
): MobileSheetSnap {
  const heights = {hidden: 0, collapsed: Math.min(320, fullHeight), full: fullHeight};
  const stops: MobileSheetSnap[] = fullHeight <= 320 ? ['hidden', 'full'] : ['hidden', 'collapsed', 'full'];
  const effectiveSnap = snap === 'collapsed' && fullHeight <= 320 ? 'full' : snap;
  if (Math.abs(delta) <= 36) return snap;
  const targetHeight = Math.max(0, Math.min(fullHeight, startHeight + delta));
  const closest = stops.reduce((best, next) =>
    Math.abs(heights[next] - targetHeight) < Math.abs(heights[best] - targetHeight) ? next : best,
  );
  const index = stops.indexOf(effectiveSnap);
  const nearestIndex = stops.indexOf(closest);
  const targetIndex = delta > 0 ? Math.max(index + 1, nearestIndex) : Math.min(index - 1, nearestIndex);
  return stops[Math.max(0, Math.min(stops.length - 1, targetIndex))];
}
