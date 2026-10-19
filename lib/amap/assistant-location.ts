import {loadAmapPlaceSdk} from './place-search';
import {coordinatesSchema, type AssistantOrigin} from '../assistant/contracts';

type LocationResult = {
  position?: {lng?: number; lat?: number} | null;
  addressComponent?: {city?: string; province?: string; adcode?: string};
};
export function mapLocatedOrigin(
  result: LocationResult,
  label: string,
): AssistantOrigin | null {
  const coordinates = coordinatesSchema.safeParse([
    result.position?.lng,
    result.position?.lat,
  ]);
  const address = result.addressComponent;
  const text = [address?.city, address?.province, address?.adcode]
    .filter(Boolean)
    .join(' ');
  const city =
    text.includes('珠海') || address?.adcode?.startsWith('4404')
      ? '珠海'
      : text.includes('澳门') || address?.adcode?.startsWith('82')
        ? '澳门'
        : null;
  return coordinates.success && city
    ? {coordinates: coordinates.data, label, city}
    : null;
}

export async function locateAssistantOrigin(
  key: string,
  label: string,
): Promise<AssistantOrigin> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (origin: AssistantOrigin | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (origin) resolve(origin);
      else reject(new Error('Location unavailable'));
    };
    const timer = setTimeout(() => finish(null), 18000);
    void loadAmapPlaceSdk(key)
      .then((amap) => {
        const sdk = amap as unknown as {
          plugin: (name: string, cb: () => void) => void;
          Geolocation: new (options: object) => {
            getCurrentPosition: (
              cb: (status: string, result: LocationResult) => void,
            ) => void;
          };
        };
        sdk.plugin('AMap.Geolocation', () => {
          try {
            new sdk.Geolocation({
              enableHighAccuracy: true,
              timeout: 10000,
              convert: true,
            }).getCurrentPosition((status, result) =>
              finish(
                status === 'complete' ? mapLocatedOrigin(result, label) : null,
              ),
            );
          } catch {
            finish(null);
          }
        });
      })
      .catch(() => finish(null));
  });
}
