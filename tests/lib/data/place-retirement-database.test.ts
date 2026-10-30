import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
const migration = readFileSync('supabase/migrations/20261029163254_retire_legacy_place_paths.sql', 'utf8');
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.shops(id uuid primary key);
    create table public.places(id uuid primary key, legacy_shop_id uuid, name text, status text);
    create table public.shop_action_events(id integer primary key,shop_id uuid references public.shops(id));
    grant select,insert,update,delete on public.shops to anon,authenticated;
    grant select,insert on public.shop_action_events to anon,authenticated;
    insert into public.places values('11111111-1111-4111-8111-111111111111',null,'真实地点','published');`);
  return db;
}
describe('retiring empty legacy place storage', () => {
  it('keeps canonical IDs and facts while accepting actions for canonical-only places', async () => {
    const db = await fixture();
    try {
      await db.exec(migration);
      await db.exec(`set role anon; insert into public.shop_action_events values(1,'11111111-1111-4111-8111-111111111111'); reset role;`);
      expect((await db.query('select id,name,status from public.places')).rows).toEqual([
        {id: '11111111-1111-4111-8111-111111111111',name:'真实地点',status:'published'}
      ]);
      expect((await db.query('select count(*)::int n from public.shop_action_events')).rows).toEqual([{n:1}]);
      await db.exec('set role anon');
      expect((await db.query('select * from public.shops')).rows).toEqual([]);
      await db.exec('reset role');
      await expect(db.exec(`set role authenticated; insert into public.shops values('22222222-2222-4222-8222-222222222222');`)).rejects.toMatchObject({code:'42501'});
    } finally {await db.close();}
  }, 30000);
  it('refuses an environment with old records without partially changing its privileges', async () => {
    const db = await fixture();
    try {
      await db.exec(`insert into public.shops values('22222222-2222-4222-8222-222222222222');`);
      await expect(db.exec(migration)).rejects.toThrow(/legacy|shops/i);
      await db.exec('rollback');
      expect((await db.query("select has_table_privilege('authenticated','public.shops','INSERT') allowed")).rows).toEqual([{allowed:true}]);
      expect((await db.query('select count(*)::int n from public.shops')).rows).toEqual([{n:1}]);
    } finally {await db.close();}
  }, 30000);
  it('refuses unresolved historical place links instead of hiding their records', async () => {
    const db = await fixture();
    try {
      await db.exec('update public.places set legacy_shop_id=id');
      await expect(db.exec(migration)).rejects.toThrow(/legacy/i);
    } finally {await db.close();}
  }, 30000);
});
