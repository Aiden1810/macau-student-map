import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const withoutProfile = '33333333-3333-4333-8333-333333333333';
const removed = '44444444-4444-4444-8444-444444444444';
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key, email text, created_at timestamptz, deleted_at timestamptz, is_anonymous boolean default false, encrypted_password text);
    create table public.profiles(id uuid primary key, role text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users(id,email,created_at) values
      ('${admin}','admin@example.test','2026-10-01'),('${member}','student@example.test','2026-10-02'),('${withoutProfile}',null,'2026-10-03'),
      ('${removed}','removed@example.test','2026-10-04'),('55555555-5555-4555-8555-555555555555',null,'2026-10-05');
    update auth.users set deleted_at=now() where id='${removed}';
    update auth.users set is_anonymous=true where id='55555555-5555-4555-8555-555555555555';
    insert into public.profiles values ('${admin}','admin'),('${member}','member');`);
  await db.exec(readFileSync('supabase/migrations/20261021130159_admin_user_directory.sql', 'utf8'));
}, 20000);
afterAll(async () => {await db.close();});
async function identity(id: string | null, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ''}',false);`);
}
async function directory(query = '', page = 1, size = 2) {
  return (await db.query<{data: {total: number; matched: number; items: Array<Record<string, unknown>>}}>(
    'select public.admin_list_users($1,$2,$3) as data', [query, page, size])).rows[0].data;
}
describe('administrator user directory with real PostgreSQL permissions', () => {
  it('counts registered accounts even without profiles and returns only a bounded page of safe fields', async () => {
    await identity(admin);
    const first = await directory();
    expect(first.total).toBe(3);
    expect(first.matched).toBe(3);
    expect(first.items.map(item => item.id)).toEqual([withoutProfile, member]);
    expect(Object.keys(first.items[0]).sort()).toEqual(['createdAt', 'email', 'id', 'role']);
    expect((await directory('', 2)).items.map(item => item.id)).toEqual([admin]);
  });
  it('searches email case-insensitively, treats wildcard characters literally and keeps the overall count', async () => {
    await identity(admin);
    expect(await directory('STUDENT')).toMatchObject({total: 3, matched: 1, items: [{email: 'student@example.test'}]});
    expect(await directory('%')).toMatchObject({total: 3, matched: 0, items: []});
    expect(await directory('', 99)).toMatchObject({total: 3, matched: 3, items: []});
  });
  it('blocks members and authenticated requests without an identity, including direct private calls', async () => {
    for (const id of [member, null]) {
      await identity(id);
      await expect(directory()).rejects.toMatchObject({code: '42501'});
      await expect(db.query('select * from public.admin_account_emails($1)', [[member]])).rejects.toMatchObject({code: '42501'});
      await expect(db.query("select private.admin_list_users('',1,25)")).rejects.toMatchObject({code: '42501'});
    }
  });
  it('blocks anonymous callers and never grants clients direct access to auth.users', async () => {
    await identity(null, 'anon');
    await expect(directory()).rejects.toMatchObject({code: '42501'});
    await expect(db.query('select * from public.admin_account_emails($1)', [[member]])).rejects.toMatchObject({code: '42501'});
    await identity(admin);
    await expect(db.query('select email from auth.users')).rejects.toMatchObject({code: '42501'});
  });
  it('limits batch email lookups to requested accounts, excluding removed accounts', async () => {
    await identity(admin);
    expect((await db.query('select * from public.admin_account_emails($1)', [[member, member, removed]])).rows)
      .toEqual([{user_id: member, email: 'student@example.test'}]);
    expect((await db.query('select * from public.admin_account_emails($1)', [[]])).rows).toEqual([]);
  });
  it('rejects invalid pagination and oversized lookup batches at the database boundary', async () => {
    await identity(admin);
    for (const args of [['', 0, 25], ['', 1, 51], ['x'.repeat(201), 1, 25], ['', null, 25]]) {
      await expect(db.query('select public.admin_list_users($1,$2,$3)', args)).rejects.toMatchObject({code: '22023'});
    }
    await expect(db.query('select * from public.admin_account_emails($1)', [Array(501).fill(member)])).rejects.toMatchObject({code: '22023'});
  });
});
