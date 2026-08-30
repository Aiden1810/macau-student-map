import {describe, expect, it} from 'vitest';
import {requireUser, type UserLookup} from '../../../lib/auth/require-user';
import {requireAdmin, type RoleLookup} from '../../../lib/auth/require-admin';

const member = {id: 'user-1', email: 'member@example.com'};

function request(authorization?: string): Request {
  return new Request('https://example.com/api', {
    headers: authorization ? {authorization} : undefined
  });
}

describe('requireUser', () => {
  it('rejects requests without a bearer token', async () => {
    const lookup: UserLookup = async () => ({user: null, error: null});
    await expect(requireUser(request(), {lookupUser: lookup})).resolves.toMatchObject({
      ok: false,
      error: {code: 'UNAUTHORIZED', status: 401}
    });
  });

  it('rejects invalid or expired tokens', async () => {
    const lookup: UserLookup = async () => ({user: null, error: new Error('expired')});
    await expect(requireUser(request('Bearer expired-token'), {lookupUser: lookup})).resolves.toMatchObject({
      ok: false,
      error: {code: 'UNAUTHORIZED', status: 401}
    });
  });

  it('returns the verified user and token', async () => {
    const lookup: UserLookup = async () => ({user: member, error: null});
    await expect(requireUser(request('Bearer valid-token'), {lookupUser: lookup})).resolves.toEqual({
      ok: true,
      user: member,
      accessToken: 'valid-token'
    });
  });
});

describe('requireAdmin', () => {
  it('rejects a valid member without an admin profile role', async () => {
    const lookupUser: UserLookup = async () => ({user: member, error: null});
    const lookupRole: RoleLookup = async () => ({role: 'member', error: null});

    await expect(
      requireAdmin(request('Bearer valid-token'), {lookupUser, lookupRole})
    ).resolves.toMatchObject({
      ok: false,
      error: {code: 'FORBIDDEN', status: 403}
    });
  });

  it('returns a verified administrator', async () => {
    const lookupUser: UserLookup = async () => ({user: member, error: null});
    const lookupRole: RoleLookup = async () => ({role: 'admin', error: null});

    await expect(
      requireAdmin(request('Bearer valid-token'), {lookupUser, lookupRole})
    ).resolves.toEqual({
      ok: true,
      user: member,
      accessToken: 'valid-token',
      role: 'admin'
    });
  });
});
