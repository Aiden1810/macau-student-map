import {isPublicTrafficPath} from '../admin/traffic';

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1'
    || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    || host === '0.0.0.0';
}

export function shouldTrackVisit(hostname: string, path: string, environment: string | undefined): boolean {
  return environment === 'production' && !isLocalHostname(hostname) && isPublicTrafficPath(path);
}
