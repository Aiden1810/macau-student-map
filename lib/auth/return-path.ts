/** Accept only same-site paths; reject encoded redirects and login loops. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return '/';
  }
  if (/[\\\s\u0000-\u001f]/.test(decoded) || decoded.startsWith('//') || /%[0-9a-f]{2}/i.test(decoded))
    return '/';
  if (/\/(?:login|admin-login|auth\/callback)(?:[/?#]|$)/.test(decoded)) return '/';
  return value;
}
