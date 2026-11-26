export function activeMainSection(pathname: string) {
  if (pathname === '/' || /^\/shop(?:\/|$)/.test(pathname)) return 'discover';
  if (/^\/choose(?:\/|$)/.test(pathname)) return 'choose';
  if (/^\/(?:me|meal-history|my-submissions|login)(?:\/|$)/.test(pathname)) return 'me';
  return null;
}
