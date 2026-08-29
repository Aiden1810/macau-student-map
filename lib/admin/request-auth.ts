export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export function isAdminRole(role: unknown): boolean {
  return role === 'admin';
}
