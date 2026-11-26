import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const alice = '22222222-2222-4222-8222-222222222222';
const bob = '33333333-3333-4333-8333-333333333333';
const db = new PGlite();

async function assume(role: 'anon' | 'authenticated', id = '') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${id}', false);`);
}

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users values ('${alice}'), ('${bob}');
    grant usage on schema public, auth to anon, authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20261125111704_private_meal_history.sql', 'utf8'));
}, 30000);

afterAll(() => db.close());

describe.sequential('private meal history and taste profile policies', () => {
  it('allows an owner to record a confirmed meal, edit feedback, and delete the entry', async () => {
    await assume('authenticated', alice);
    const inserted = await db.query<{id: string}>(`insert into meal_history(user_id, restaurant_name, eaten_on, feedback)
      values ($1, 'Cafe', '2026-11-24', 'liked') returning id`, [alice]);
    const id = inserted.rows[0].id;
    const retried = await db.query(`insert into meal_history(id,user_id,restaurant_name,eaten_on)
      values ($1,$2,'Cafe','2026-11-24') on conflict (id) do nothing returning id`, [id, alice]);
    expect(retried.rows).toEqual([]);
    expect((await db.query(`update meal_history set feedback='neutral' where id=$1 returning feedback`, [id])).rows)
      .toEqual([{feedback: 'neutral'}]);
    expect((await db.query('delete from meal_history where id=$1 returning id', [id])).rows).toEqual([{id}]);
  });

  it('restricts select, edit and delete to each owner and rejects assigning rows to another account', async () => {
    await assume('authenticated', alice);
    const meals = await db.query<{id: string}>(`insert into meal_history(user_id, restaurant_name, eaten_on)
      values ($1, 'Private Cafe', '2026-11-24') returning id`, [alice]);
    const preferences = await db.query<{id: string}>(`insert into meal_taste_preferences(user_id, kind, label, sentiment)
      values ($1, 'cuisine', 'Cantonese', 'like') returning id`, [alice]);
    const mealId = meals.rows[0].id;
    const preferenceId = preferences.rows[0].id;
    await expect(db.query('update meal_history set user_id=$1 where id=$2', [bob, mealId])).rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into meal_taste_preferences(user_id, kind, label, sentiment)
      values ($1, 'cuisine', ' cantonese ', 'avoid')`, [alice])).rejects.toThrow(/duplicate key/);

    await assume('authenticated', bob);
    expect((await db.query('select id from meal_history')).rows).toEqual([]);
    expect((await db.query('select id from meal_taste_preferences')).rows).toEqual([]);
    expect((await db.query('delete from meal_history where id=$1 returning id', [mealId])).rows).toEqual([]);
    expect((await db.query(`update meal_taste_preferences set sentiment='avoid' where id=$1 returning id`, [preferenceId])).rows).toEqual([]);
    await expect(db.query(`insert into meal_history(user_id, restaurant_name, eaten_on)
      values ($1, 'Spoofed', '2026-11-24')`, [alice])).rejects.toThrow(/row-level security/);

    await assume('authenticated', alice);
    expect((await db.query(`update meal_taste_preferences set sentiment='avoid' where id=$1 returning sentiment`, [preferenceId])).rows)
      .toEqual([{sentiment: 'avoid'}]);
    expect((await db.query('delete from meal_taste_preferences where id=$1 returning id', [preferenceId])).rows).toEqual([{id: preferenceId}]);
  });

  it('denies anonymous reads of meals and taste preferences', async () => {
    await assume('anon');
    await expect(db.query('select * from meal_history')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from meal_taste_preferences')).rejects.toThrow(/permission denied/);
  });
});
