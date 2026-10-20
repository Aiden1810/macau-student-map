import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
beforeAll(async () => {
  const source = readFileSync('supabase/migrations/20260830103144_canonical_local_life_model.sql', 'utf8');
  const table = source.match(/create table if not exists public\.search_events \([\s\S]*?\n\);/)![0];
  const policies = source.slice(source.indexOf('drop policy if exists canonical_search_events_anon_insert'), source.indexOf('drop policy if exists canonical_admin_audit_admin_read'));
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key); create table public.profiles(id uuid primary key, role text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant usage on schema public, auth, private to anon, authenticated;
    grant execute on function auth.uid(), private.current_user_is_admin() to anon, authenticated;
    insert into public.profiles values ('${admin}','admin'),('${member}','user');
    ${table}
    alter table public.search_events enable row level security;
    revoke all on public.search_events from anon,authenticated;
    grant insert on public.search_events to anon,authenticated;
    ${policies}
    insert into public.search_events(query,result_count) values ('咖啡',1),('面',0);`);
  await db.exec(readFileSync('supabase/migrations/20261019163622_admin_search_events_read.sql', 'utf8'));
}, 20000);
afterAll(async () => {await db.close();});
async function identity(user: string | null, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user ?? ''}',false);`);
}
describe('search report table grants and real PostgreSQL RLS', () => {
  it('allows administrators to read search records after the local migration', async () => {
    await identity(admin);
    const result = await db.query('select query,result_count from public.search_events order by id');
    expect(result.rows).toEqual([{query: '咖啡', result_count: 1}, {query: '面', result_count: 0}]);
  });
  it('keeps ordinary accounts from reading other users search records', async () => {
    await identity(member);
    expect((await db.query('select * from public.search_events')).rows).toHaveLength(0);
  });
  it('does not grant anonymous SELECT or authenticated UPDATE/DELETE', async () => {
    await identity(null, 'anon');
    await expect(db.query('select * from public.search_events')).rejects.toMatchObject({code: '42501'});
    await db.exec('reset role');
    expect((await db.query("select has_table_privilege('authenticated','public.search_events','UPDATE') as updates, has_table_privilege('authenticated','public.search_events','DELETE') as deletes")).rows).toEqual([{updates: false, deletes: false}]);
  });
});
