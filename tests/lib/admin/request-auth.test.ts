import {describe, expect, it} from 'vitest';
import {isAdminRole, readBearerToken} from '../../../lib/admin/request-auth';

describe('readBearerToken', () => {
  it('returns a trimmed bearer token', () => {
    const request = new Request('https://example.com', {
      headers: {authorization: 'Bearer   token-123   '}
    });

    expect(readBearerToken(request)).toBe('token-123');
  });

  it.each([undefined, '', 'Basic token-123', 'Bearer   '])('rejects an invalid authorization header: %s', (authorization) => {
    const request = new Request('https://example.com', {
      headers: authorization ? {authorization} : undefined
    });

    expect(readBearerToken(request)).toBeNull();
  });
});

describe('isAdminRole', () => {
  it('only accepts the exact admin role', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('Admin')).toBe(false);
    expect(isAdminRole('student')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});
