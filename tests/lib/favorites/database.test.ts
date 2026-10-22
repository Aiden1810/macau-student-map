import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const alice = '22222222-2222-4222-8222-222222222222';
const bob = '33333333-3333-4333-8333-333333333333';
const admin = '44444444-4444-4444-8444-444444444444';
const old = '11111111-1111-4111-8111-111111111111';
const addedLater = '11111111-1111-4111-8111-111111111112';
const newPlace = '11111111-1111-4111-8111-111111111113';
const orphan = '11111111-1111-4111-8111-111111111114';
const rollback = '11111111-1111-4111-8111-111111111115';
const db = new PGlite();
const favoritesMigration = readFileSync('supabase/migrations/20261022160000_canonical_favorites.sql', 'utf8');
const archiveMigration = readFileSync('supabase/migrations/20261022160100_archive_deleted_legacy_places.sql', 'utf8');

async function schema(database: PGlite) {
  await database.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$
      select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    create table public.place_categories(slug text primary key);
    insert into public.place_categories values('food'),('shopping'),('entertainment'),('service');
    grant usage on schema public,auth,private to anon,authenticated;
    insert into auth.users values('${alice}'),('${bob}'),('${admin}');
    insert into public.profiles values('${alice}','user'),('${bob}','user'),('${admin}','admin');`);
  const source = readFileSync('supabase/migrations/20260830103144_canonical_local_life_model.sql', 'utf8');
  const start = source.indexOf('create table if not exists public.places (');
  const end = source.indexOf('create table if not exists public.place_tags (', start);
  await database.exec(source.slice(start, end));
  await database.exec(`alter table public.places enable row level security;
    grant select on public.places to anon,authenticated;
    create policy published_places on public.places for select to anon,authenticated using(status='published');`);
}
async function identity(user: string | null, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user ?? ''}',false);`);
}
beforeAll(async () => {
  await schema(db);
  await db.exec(`create table public.shops(id uuid primary key,name text,address text,category text,status text);
    insert into public.shops values('${old}','旧店','旧地址','food','verified'),
      ('${addedLater}','后来加入的旧店',null,'food','verified'),('${rollback}','事务测试店',null,'food','verified');
    insert into public.places(id,legacy_shop_id,name,category_slug,status,published_at) values
      ('${old}','${old}','旧店','food','published',now()),
      ('${newPlace}',null,'新店','food','published',now()),
      ('${orphan}','${orphan}','已被删除的旧店','food','published',now()),
      ('${rollback}','${rollback}','事务测试店','food','published',now());
    create table public.favorites(user_id uuid references auth.users on delete cascade,
      shop_id uuid references public.shops on delete cascade,created_at timestamptz not null default now(),primary key(user_id,shop_id));
    insert into public.favorites values('${alice}','${old}','2026-10-01T00:00:00Z'),
      ('${alice}','${addedLater}','2026-10-02T00:00:00Z'),('${bob}','${old}','2026-10-03T00:00:00Z');`);
  await db.exec(favoritesMigration);
  await db.exec(archiveMigration);
  await db.exec(readFileSync('supabase/migrations/20260830103204_harden_legacy_public_access.sql', 'utf8'));
}, 30000);
afterAll(async () => {await db.close();});

describe.sequential('canonical favorites and legacy deletion in PostgreSQL', () => {
  it('preserves old saves and creation timestamps and backfills a missing canonical reference', async () => {
    const saved = (await db.query<{shop_id: string; created_at: Date}>(
      'select shop_id,created_at from public.favorites where user_id=$1 order by created_at', [alice]
    )).rows.map(row => ({shop_id: row.shop_id, created_at: row.created_at.toISOString()}));
    expect(saved).toEqual([{shop_id: old, created_at: '2026-10-01T00:00:00.000Z'},
      {shop_id: addedLater, created_at: '2026-10-02T00:00:00.000Z'}]);
    expect((await db.query('select id,name,status from public.places where id=$1', [addedLater])).rows)
      .toEqual([{id: addedLater, name: '后来加入的旧店', status: 'published'}]);
  });
  it('lets an ordinary account favorite and unfavorite a canonical-only place idempotently', async () => {
    await identity(alice);
    for (let attempt = 0; attempt < 2; attempt++) {
      await db.query('insert into public.favorites(user_id,shop_id) values($1,$2) on conflict(user_id,shop_id) do nothing', [alice, newPlace]);
    }
    expect((await db.query('select shop_id from public.favorites where shop_id=$1', [newPlace])).rows).toEqual([{shop_id: newPlace}]);
    await db.query('delete from public.favorites where user_id=$1 and shop_id=$2', [alice, newPlace]);
    expect((await db.query('select shop_id from public.favorites where shop_id=$1', [newPlace])).rows).toEqual([]);
  });
  it('keeps account rows private and rejects forged ownership and direct updates', async () => {
    await identity(bob);
    expect((await db.query('select distinct user_id from public.favorites')).rows).toEqual([{user_id: bob}]);
    await expect(db.query('insert into public.favorites(user_id,shop_id) values($1,$2)', [alice, newPlace])).rejects.toMatchObject({code: '42501'});
    await expect(db.query('update public.favorites set shop_id=$1 where user_id=$2', [newPlace, bob])).rejects.toMatchObject({code: '42501'});
    expect((await db.query('delete from public.favorites where user_id=$1 returning shop_id', [alice])).rows).toEqual([]);
    await identity(null, 'anon');
    await expect(db.query('select * from public.favorites')).rejects.toMatchObject({code: '42501'});
  });
  it('archives earlier orphan copies without affecting unrelated published places', async () => {
    await identity(null, 'postgres');
    expect((await db.query('select status from public.places where id=$1', [orphan])).rows).toEqual([{status: 'archived'}]);
    expect((await db.query('select status from public.places where id=$1', [newPlace])).rows).toEqual([{status: 'published'}]);
  });
  it('prevents a non-admin deletion and archives both views atomically on an admin deletion', async () => {
    await identity(alice);
    expect((await db.query('delete from public.shops where id=$1 returning id', [old])).rows).toEqual([]);
    await identity(admin);
    expect((await db.query('delete from public.shops where id=$1 returning id', [old])).rows).toEqual([{id: old}]);
    // The trigger bypasses place write RLS, while the administrator cannot.
    expect((await db.query('select id from public.places where id=$1', [old])).rows).toEqual([]);
    await identity(alice);
    expect((await db.query('select shop_id from public.favorites where shop_id=$1', [old])).rows).toEqual([{shop_id: old}]);
    await identity(null, 'postgres');
    expect((await db.query('select status from public.places where id=$1', [old])).rows).toEqual([{status: 'archived'}]);
  });
  it('rolls the archive back with the legacy deletion if the transaction fails', async () => {
    await identity(admin);
    await db.exec('begin');
    await db.query('delete from public.shops where id=$1', [rollback]);
    await db.exec('rollback');
    expect((await db.query('select id from public.shops where id=$1', [rollback])).rows).toEqual([{id: rollback}]);
    expect((await db.query('select id from public.places where id=$1', [rollback])).rows).toEqual([{id: rollback}]);
  });
  it('does not expose the elevated trigger function as a callable API', async () => {
    await identity(null, 'postgres');
    expect((await db.query("select has_function_privilege('authenticated','private.archive_deleted_legacy_place()','execute') as allowed")).rows)
      .toEqual([{allowed: false}]);
    await db.exec(favoritesMigration);
    await db.exec(archiveMigration);
    expect((await db.query('select count(*)::int as count from public.favorites')).rows).toEqual([{count: 3}]);
  });
  it('supports a fresh database with no legacy shops or favorites table', async () => {
    const fresh = new PGlite();
    try {
      await schema(fresh);
      await fresh.exec(favoritesMigration);
      await fresh.exec(archiveMigration);
      await fresh.exec(`insert into public.places(id,name,category_slug) values('${newPlace}','新店','food');
        insert into public.favorites(user_id,shop_id) values('${alice}','${newPlace}');`);
      expect((await fresh.query('select shop_id from public.favorites')).rows).toEqual([{shop_id: newPlace}]);
    } finally {await fresh.close();}
  }, 30000);
});
