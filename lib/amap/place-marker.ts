import {getPlacePresentation, type PlaceIconKey, type PlaceTypeInput} from '../domain/place-types';

// Static SVG paths only: no names, addresses or other user text are interpolated.
const ICON_PATHS: Record<PlaceIconKey, string> = {
  restaurant: '<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M19 21V3c-4 0-5 7-5 10h5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  wine: '<path d="M8 3h8l2 7a6 6 0 0 1-12 0l2-7ZM6 10h12M12 16v5M8 21h8"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01" stroke-width="3"/>',
  mystery: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M8 8a2 2 0 0 1 4 0c0 2-2 2-2 3M10 14h.01"/>',
  shop: '<path d="M3 9 5 3h14l2 6M3 9h18M5 9v12h14V9M9 21v-7h6v7"/>',
  service: '<path d="m14 5 5-2-1 5-4 2 7 7-4 4-7-7-5 2-2-5 5-3 2-5 4 2Z"/>',
  entertainment: '<path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6Z"/>',
  pin: '<path d="M12 22S4 14 4 9a8 8 0 1 1 16 0c0 5-8 13-8 13Z"/><circle cx="12" cy="9" r="2"/>'
};

export function buildPlacePinHtml(place: PlaceTypeInput, size: 'default' | 'selected' = 'default', anchored = true): string {
  const {icon, label, color} = getPlacePresentation(place);
  const width = size === 'selected' ? 44 : 36;
  const height = size === 'selected' ? 54 : 46;
  return `<div data-place-icon="${icon}" title="${label}" style="width:${width}px;height:${height}px;${anchored ? 'transform:translate(-50%,-100%);' : ''}filter:drop-shadow(0 2px 3px #0003);">
    <svg width="${width}" height="${height}" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
      <path d="M22 52S5 37 5 24a17 17 0 1 1 34 0c0 13-17 28-17 28Z" fill="white"/>
      <circle cx="22" cy="24" r="14" fill="${color}"/>
      <g transform="translate(12 14) scale(.8333)" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[icon]}</g>
    </svg>
  </div>`;
}
