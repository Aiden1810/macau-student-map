type NavigationDestination = {
  name: string;
  coordinates: readonly [number, number];
  hasCoordinates: boolean;
};

/** Coordinates must already match the AMap location displayed by the site. */
export function buildAmapNavigationUrl(
  destination: NavigationDestination,
  {callNative = true}: {callNative?: boolean} = {}
): string | null {
  const [longitude, latitude] = destination.coordinates;
  if (
    !destination.hasCoordinates ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90 ||
    (longitude === 0 && latitude === 0)
  ) {
    return null;
  }

  // AMap separates coordinates and name with commas. Keep names in one field.
  const name = destination.name.trim().replace(/[,\r\n]+/g, ' ');
  const url = new URL('https://uri.amap.com/navigation');
  url.searchParams.set('to', `${longitude},${latitude},${name}`);
  url.searchParams.set('mode', 'walk');
  url.searchParams.set('src', 'macau-student-map');
  url.searchParams.set('callnative', callNative ? '1' : '0');
  return url.toString();
}
