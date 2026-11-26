import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync, readdirSync} from 'node:fs';
import {afterAll, beforeAll, expect, it} from 'vitest';

const db = new PGlite({extensions: {pg_trgm, pgcrypto}});
const author = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const admin = '10000000-0000-4000-8000-000000000003';
const place = '20000000-0000-4000-8000-000000000001';

async function assume(role: 'anon' | 'authenticated', user = '') {
  await db.exec(`reset role; set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
}

beforeAll(async () => {
  // Supabase platform tables are test fixtures. Application migrations run verbatim.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), deleted_at timestamptz, is_anonymous boolean);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(bucket_id text, name text, owner_id text, unique(bucket_id, name));
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select (string_to_array($1, '/'))[1:cardinality(string_to_array($1, '/')) - 1]
    $$;
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage to anon, authenticated, service_role;
    grant insert, select, update, delete on storage.objects to authenticated;
  `);
  await db.exec(readFileSync('supabase/fixtures/legacy-baseline.sql', 'utf8'));
  const directory = 'supabase/migrations';
  for (const file of readdirSync(directory).filter(file => file.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(`${directory}/${file}`, 'utf8'));
    } catch (error) {
      throw new Error(`Could not apply ${file}`, {cause: error});
    }
  }
  await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [author, otherUser, admin]);
  await db.query("insert into public.profiles(id, role) values ($1, 'admin')", [admin]);
  await db.query(`insert into public.places(id, name, address, category_slug, status, published_at)
    values ($1, 'Fixture restaurant', 'Fixture address', 'food', 'published', now())`, [place]);
}, 30000);

afterAll(() => db.close());

it('enforces review approval and keeps meal feedback private across the full migration chain', async () => {
  await assume('authenticated', author);
  const {rows: [{review}]} = await db.query<{review: {id: string; updated_at: string}}>(
    "select public.save_place_review($1, 4, 'Fixture review', null) as review", [place]);
  await db.query(`insert into public.meal_history(user_id, restaurant_name, eaten_on, feedback)
    values ($1, 'Fixture restaurant', current_date, 'liked')`, [author]);

  await assume('authenticated', otherUser);
  expect((await db.query('select id from public.reviews')).rows).toEqual([]);
  expect((await db.query('select id from public.meal_history')).rows).toEqual([]);

  await assume('authenticated', admin);
  await db.query("select public.moderate_place_review($1, 'approved', null, $2)", [review.id, review.updated_at]);
  expect((await db.query('select id from public.meal_history')).rows).toEqual([]);

  await assume('anon');
  expect((await db.query('select id from public.reviews')).rows).toEqual([{id: review.id}]);
  expect((await db.query('select review_count from public.places where id = $1', [place])).rows).toEqual([{review_count: 1}]);
  await expect(db.query('select id from public.meal_history')).rejects.toMatchObject({code: '42501'});

  await assume('authenticated', author);
  expect((await db.query('select feedback from public.meal_history')).rows).toEqual([{feedback: 'liked'}]);
});
