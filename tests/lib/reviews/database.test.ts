import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const place = '11111111-1111-4111-8111-111111111111';
const alice = '22222222-2222-4222-8222-222222222222';
const bob = '33333333-3333-4333-8333-333333333333';
const admin = '44444444-4444-4444-8444-444444444444';
const db = new PGlite();
type Row = {
  id: string;
  updated_at: string;
  status: string;
  moderation_status: string;
  deleted_at: string | null;
};
async function identity(user: string | null, role = 'authenticated') {
  await db.exec(
    `reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`
  );
}
async function save(user: string, rating: number, version: string | null = null) {
  await identity(user);
  return (
    await db.query<{review: Row}>('select public.save_place_review($1, $2, $3, $4) as review', [
      place,
      rating,
      '真实体验',
      version
    ])
  ).rows[0].review;
}
async function stats() {
  await identity(null, 'anon');
  return (
    await db.query(
      'select rating_average::float8 as average, review_count as count from public.places where id=$1',
      [place]
    )
  ).rows[0];
}
async function moderate(row: Row, decision: 'approved' | 'rejected') {
  await identity(admin);
  return (
    await db.query<{review: Row}>('select public.moderate_place_review($1,$2,$3,$4) as review', [
      row.id,
      decision,
      decision === 'rejected' ? '含广告信息' : null,
      row.updated_at
    ])
  ).rows[0].review;
}
beforeAll(async () => {
  // Reuse actual repository DDL for reviews, policies, timestamps and ranking.
  const source = readFileSync('supabase/migrations/20260830103144_canonical_local_life_model.sql', 'utf8');
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key references auth.users, role text);
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    create table public.places(id uuid primary key, legacy_shop_id uuid, name text, status text, rating_average numeric(3,2), review_count integer default 0, confidence_score numeric, updated_at timestamptz default now());
    create table public.admin_audit_logs(id uuid default gen_random_uuid(), actor_id uuid, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz default now());
    grant usage on schema public, auth, private to anon, authenticated;
    grant execute on function auth.uid(), private.current_user_is_admin() to anon, authenticated;
    insert into auth.users values ('${alice}'),('${bob}'),('${admin}');
    insert into public.profiles values ('${alice}','user'),('${bob}','user'),('${admin}','admin');
    insert into public.places(id,name,status) values ('${place}','测试店铺','published');
    alter table public.places enable row level security;
    create policy public_places on public.places for select to anon,authenticated using(status='published');
    create policy admin_places on public.places for all to authenticated using(private.current_user_is_admin());
    grant select,update on public.places to anon,authenticated;`);
  const section = (start: string, end: string) =>
    source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  await db.exec(
    section('create table if not exists public.reviews (', 'create table if not exists public.review_media (')
  );
  await db.exec(
    section(
      'create table if not exists public.review_media (',
      'create table if not exists public.search_events ('
    )
  );
  await db.exec(
    'alter table public.review_media enable row level security; grant select on public.review_media to anon,authenticated;'
  );
  await db.exec(
    section(
      'create or replace function public.set_updated_at()',
      'drop trigger if exists profiles_set_updated_at'
    )
  );
  await db.exec(
    section(
      'create or replace function public.calculate_confidence_score(',
      'create or replace function public.refresh_place_search_keywords()'
    )
  );
  await db.exec(`create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();
    alter table public.reviews enable row level security; grant select on public.reviews to anon,authenticated; grant insert,update,delete on public.reviews to authenticated;`);
  await db.exec(
    section(
      'drop policy if exists canonical_reviews_public_read',
      'drop policy if exists canonical_review_media_public_read'
    )
  );
  await db.exec(readFileSync('supabase/migrations/20261019110033_review_post_moderation.sql', 'utf8'));
}, 30000);
afterAll(async () => {
  await db.close();
});

describe.sequential('real PostgreSQL review lifecycle', () => {
  let a: Row;
  let b: Row;
  it('publishes immediately for an ordinary user and updates the aggregate despite place RLS', async () => {
    a = await save(alice, 5);
    expect(a.status).toBe('published');
    expect(a.moderation_status).toBe('pending');
    expect(await stats()).toEqual({average: 5, count: 1});
    await identity(null, 'postgres');
    await db.query(
      "insert into public.review_media(review_id,uploaded_by,storage_path,mime_type,byte_size) values($1,$2,'test.webp','image/webp',100)",
      [a.id, alice]
    );
    await identity(null, 'anon');
    expect((await db.query('select id from public.review_media')).rows).toHaveLength(1);
  });
  it('counts each account once and retries do not duplicate a review', async () => {
    b = await save(bob, 3);
    expect((await save(alice, 5, a.updated_at)).id).toBe(a.id);
    expect(await stats()).toEqual({average: 4, count: 2});
  });
  it('rejects direct writes that could forge approval or bypass ownership', async () => {
    await identity(bob);
    await expect(
      db.query("update public.reviews set status='published' where id=$1", [a.id])
    ).rejects.toMatchObject({code: '42501'});
    await expect(db.query('delete from public.reviews where id=$1', [a.id])).rejects.toMatchObject({
      code: '42501'
    });
    await expect(
      db.query('select public.delete_place_review($1,$2)', [a.id, a.updated_at])
    ).rejects.toMatchObject({code: 'P0002'});
    await expect(
      db.query('select public.moderate_place_review($1,$2,$3,$4)', [a.id, 'approved', null, a.updated_at])
    ).rejects.toMatchObject({code: '42501'});
  });
  it('hides a rejected review from visitors and excludes its score', async () => {
    a = await moderate(a, 'rejected');
    expect(await stats()).toEqual({average: 3, count: 1});
    expect((await db.query('select id from public.reviews')).rows).toEqual([{id: b.id}]);
    expect((await db.query('select id from public.review_media')).rows).toHaveLength(0);
  });
  it('rejects stale moderation and stale edits', async () => {
    await identity(admin);
    await expect(
      db.query('select public.moderate_place_review($1,$2,$3,$4)', [
        a.id,
        'approved',
        null,
        '2000-01-01T00:00:00Z'
      ])
    ).rejects.toMatchObject({code: '40001'});
    await expect(save(alice, 4, '2000-01-01T00:00:00Z')).rejects.toMatchObject({code: '40001'});
  });
  it('rolls the visibility and aggregate back when writing the audit record fails', async () => {
    await identity(null, 'postgres');
    await db.exec(
      "alter table public.admin_audit_logs add constraint test_audit_failure check(action<>'review.approve') not valid"
    );
    try {
      await expect(moderate(a, 'approved')).rejects.toMatchObject({code: '23514'});
      expect(await stats()).toEqual({average: 3, count: 1});
      await identity(alice);
      expect((await db.query('select status from public.reviews where id=$1', [a.id])).rows).toEqual([
        {status: 'rejected'}
      ]);
    } finally {
      await identity(null, 'postgres');
      await db.exec('alter table public.admin_audit_logs drop constraint test_audit_failure');
    }
  });
  it('keeps rejected edits hidden and applies the same rule after deletion and reposting', async () => {
    await identity(null, 'postgres');
    await db.exec("update private.review_write_limits set last_write_at=now()-interval '1 minute'");
    a = await save(alice, 4, a.updated_at);
    expect(a.status).toBe('pending');
    expect(a.moderation_status).toBe('pending');
    expect(await stats()).toEqual({average: 3, count: 1});
    await identity(alice);
    const deleted = (
      await db.query<{review: Row}>('select public.delete_place_review($1,$2) as review', [
        a.id,
        a.updated_at
      ])
    ).rows[0].review;
    expect(deleted.deleted_at).not.toBeNull();
    await identity(null, 'postgres');
    await db.exec("update private.review_write_limits set last_write_at=now()-interval '1 minute'");
    a = await save(alice, 2, deleted.updated_at);
    expect(a.id).toBe(deleted.id);
    expect(a.status).toBe('pending');
    expect(await stats()).toEqual({average: 3, count: 1});
  });
  it('restores visibility and score only after approval; records both decisions', async () => {
    a = await moderate(a, 'approved');
    expect(await stats()).toEqual({average: 2.5, count: 2});
    expect((await db.query('select id from public.review_media')).rows).toHaveLength(1);
    await identity(null, 'postgres');
    expect((await db.query('select action from public.admin_audit_logs order by created_at')).rows).toEqual([
      {action: 'review.reject'},
      {action: 'review.approve'}
    ]);
  });
  it('limits changed submissions even through direct RPC, without changing scores', async () => {
    await expect(save(alice, 1, a.updated_at)).rejects.toMatchObject({code: '54000'});
    expect(await stats()).toEqual({average: 2.5, count: 2});
  });
  it('soft-deletes both reviews and clears the last score; deleted content stays private', async () => {
    await identity(alice);
    await db.query('select public.delete_place_review($1,$2)', [a.id, a.updated_at]);
    await identity(bob);
    await db.query('select public.delete_place_review($1,$2)', [b.id, b.updated_at]);
    expect(await stats()).toEqual({average: null, count: 0});
    expect((await db.query('select id from public.reviews')).rows).toEqual([]);
    expect((await db.query('select id from public.review_media')).rows).toHaveLength(0);
    await identity(null, 'postgres');
    expect((await db.query('select count(*)::int as count from public.reviews')).rows[0]).toEqual({count: 2});
  });
  it('denies anonymous submission', async () => {
    await identity(null, 'anon');
    await expect(db.query('select public.save_place_review($1,5,null,null)', [place])).rejects.toMatchObject({
      code: '42501'
    });
  });
});
