import {z} from 'zod';

const text = (max: number) => z.string().trim().max(max).nullable().transform(value => value || null).default(null);

/** Directions describe the place itself; a landmark never replaces its identity. */
export const locationDetailsSchema = z.object({
  source: z.enum(['unknown', 'map', 'manual']).default('unknown'),
  businessForm: z.enum(['unknown', 'store', 'stall']).default('unknown'),
  accuracy: z.enum(['unknown', 'exact', 'approximate']).default('unknown'),
  mobility: z.enum(['unknown', 'fixed', 'variable']).default('unknown'),
  description: text(500),
  landmark: text(120),
  hours: text(200)
}).strict();

export type LocationDetails = z.infer<typeof locationDetailsSchema>;

export function readLocationDetails(value?: unknown): LocationDetails {
  return locationDetailsSchema.parse(value ?? {});
}

export function requiresLocationDescription(details: LocationDetails): boolean {
  return details.source === 'manual' && !details.description;
}

export function getLocationNotice(details?: LocationDetails): string | null {
  if (!details) return null;
  const notices: string[] = [];
  if (details.accuracy === 'approximate') notices.push('大致位置，请结合位置描述寻找');
  else if (details.source === 'manual' && details.accuracy === 'unknown') notices.push('位置准确程度待确认');
  if (details.mobility === 'variable') notices.push('位置可能变化，地图标点仅作参考');
  return notices.length ? notices.join('；') : null;
}

export function getLocationCopyText(place: {name: string; address: string; locationDetails?: LocationDetails}): string {
  const details = place.locationDetails;
  const directions = [place.address.trim(), details?.description, details?.landmark ? `参考地标：${details.landmark}` : null].filter(Boolean);
  if (!directions.length) return '';
  return [place.name.trim(), ...directions, getLocationNotice(details)].filter(Boolean).join('\n');
}
