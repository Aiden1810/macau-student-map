
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync, readdirSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const db = new PGlite({extensions: {pg_trgm, pgcrypto}});
const alice = '10000000-0000-4000-8000-000000000001';
const bob = '10000000-0000-4000-8000-000000000002';
const admin = '10000000-0000-4000-8000-000000000003';
const place = '20000000-0000-4000-8000-000000000001';
const otherPlace = '20000000-0000-4000-8000-000000000002';
const first = '30000000-0000-4000-8000-000000000001';
const second = '30000000-0000-4000-8000-000000000002';
const historic = '30000000-0000-4000-8000-000000000003';
const poi = 'B000000001';
const newPoi = 'B000000002';

async function identity(role: 'anon' | 'authenticated' | 'service_role' | 'postgres', user?: string) {
  await db.exec('reset role');
  if (role !== 'postgres') await db.exec('set role ' + role);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
}

async function submit(who: string, id: string, target: string, hasImage = false) {
  await identity('service_role');
  return db.query("select submit_student_recommendation($1,$2,$3,$4,'推荐理由','特色菜',45.5,'MOP','per_person','聚餐',$5) as id",
    [who, id, target === place ? target : null, target === place ? null : target, hasImage]);
}

beforeAll(async () => {
  // Only platform schemas are emulated. Apply all application migrations verbatim.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), deleted_at timestamptz, is_anonymous boolean);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(bucket_id text, name text, owner_id text, unique(bucket_id,name));
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select (string_to_array($1, '/'))[1:cardinality(string_to_array($1, '/')) - 1]
    $$;
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage to authenticated, anon, service_role;
    grant insert, select, update, delete on storage.objects to authenticated;
    insert into auth.users(id) values ('${alice}'),('${bob}'),('${admin}');
  `);
  const migrations = 'supabase/migrations';
  const p1 = '20261123120000_discovery_recommendations.sql';
  await db.exec(readFileSync('supabase/fixtures/legacy-baseline.sql', 'utf8'));
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql') && file < p1).sort()) {
    try {await db.exec(readFileSync(migrations + '/' + file, 'utf8'));}
    catch (error) {throw new Error(file + ': ' + (error as Error).message, {cause: error});}
  }
  await db.exec(`
    insert into profiles(id,role) values ('${admin}','admin');
    insert into places(id,name,address,latitude,longitude,category_slug,status,published_at) values
      ('${place}','同名店','澳门 A 街',22.18,113.54,'food','published',now()),
      ('${otherPlace}','同名店','澳门 B 街',22.19,113.55,'food','published',now());
    insert into place_media(id,place_id,uploaded_by,bucket_id,storage_path,mime_type,byte_size,lifecycle_status)
      values ('${historic}','${place}','${alice}','place-media','historic.jpg','image/jpeg',100,'ready');
    insert into storage.objects values ('place-media','historic.jpg','${alice}');
  `);
  await db.query('insert into favorites(user_id,shop_id) values($1,$2)', [alice, place]);
  await db.query("insert into reviews(id,place_id,user_id,rating,content,status) values($1,$2,$3,5,'历史评价','published')",
    [historic, place, alice]);
  await db.exec(readFileSync('supabase/migrations/20261123120000_discovery_recommendations.sql', 'utf8'));
}, 15000);
afterAll(async () => {await db.close();});

describe('student recommendations and POI persistence in PostgreSQL', () => {
  it('keeps history and exact identity, allows multiple recommendations, and enforces visibility and ownership', async () => {
    await identity('anon');
    expect((await db.query('select * from discovery_catalog(array[113.5,22.1,113.6,22.3]::float8[])')).rows).toHaveLength(2);
    expect((await db.query("select * from discovery_catalog(p_text => '同名店', p_city => '澳门')")).rows).toHaveLength(2);
    expect((await db.query("select * from discovery_catalog(p_text => '同名店', p_city => '北京市')")).rows).toEqual([]);
    expect((await db.query('select * from discovery_poi_metadata(array[$1])', [poi])).rows).toEqual([]);
    await expect(db.query("select save_verified_discovery_favorite($1,$2,true)", [alice, poi])).rejects.toMatchObject({code: '42501'});
    await expect(db.query('select * from student_recommendations')).rejects.toMatchObject({code: '42501'});

    await identity('authenticated', alice);
    await db.query("insert into storage.objects values('student-recommendation-media',$1,$2)", [first, alice]);
    await expect(db.query("insert into storage.objects values('student-recommendation-media',$1,$2)", [second, bob])).rejects.toMatchObject({code: '42501'});
    expect((await db.query("select * from storage.objects where bucket_id='student-recommendation-media'")).rows).toEqual([]);

    await expect(submit(bob, first, poi, true)).rejects.toThrow('Image unavailable');
    expect((await submit(alice, first, poi, true)).rows).toEqual([{id: first}]);
    expect((await submit(alice, first, poi, true)).rows).toEqual([{id: first}]);
    await expect(submit(bob, first, poi)).rejects.toThrow('Recommendation ID already in use');
    await submit(bob, second, poi);
    await submit(alice, historic, place);

    await identity('anon');
    expect((await db.query('select * from list_student_recommendations(null,$1)', [poi])).rows).toEqual([]);
    expect((await db.query('select * from discovery_poi_metadata(array[$1])', [poi])).rows[0]).toMatchObject({recommended: false, place_id: null});
    expect((await db.query('select student_recommendation_image($1) as path', [first])).rows).toEqual([{path: null}]);

    await identity('authenticated', bob);
    await expect(db.query('select associate_verified_discovery_poi($1,$2)', [poi, place])).rejects.toMatchObject({code: '42501'});
    await expect(db.query('select save_verified_discovery_favorite($1,$2,true)', [alice, poi])).rejects.toMatchObject({code: '42501'});
    await expect(db.query('select * from admin_student_recommendations(true)')).rejects.toMatchObject({code: '42501'});
    expect((await db.query('select student_recommendation_image($1) as path', [first])).rows).toEqual([{path: null}]);
    expect((await db.query('select * from my_student_recommendations(null,$1)', [poi])).rows).toMatchObject([{id: second, status: 'pending'}]);
    expect((await db.query('select remove_my_student_recommendation($1) as removed', [first])).rows).toEqual([{removed: false}]);
    await expect(db.query("select moderate_student_recommendation($1,'pending','approved')", [first])).rejects.toMatchObject({code: '42501'});

    await identity('authenticated', admin);
    expect((await db.query('select student_recommendation_image($1) as path', [first])).rows).toEqual([{path: first}]);
    expect((await db.query('select * from admin_student_recommendations(true)')).rows).toHaveLength(3);
    await db.query("select moderate_student_recommendation($1,'pending','approved')", [first]);
    await db.query("select moderate_student_recommendation($1,'pending','approved')", [second]);
    await db.query("select moderate_student_recommendation($1,'pending','approved')", [historic]);
    expect((await db.query("select moderate_student_recommendation($1,'pending','rejected') as changed", [first])).rows).toEqual([{changed: false}]);

    await identity('anon');
    expect((await db.query('select * from list_student_recommendations(null,$1)', [poi])).rows).toHaveLength(2);
    expect((await db.query('select * from discovery_poi_metadata(array[$1])', [poi])).rows[0]).toMatchObject({recommended: true});
    expect((await db.query('select student_recommendation_image($1) as path', [first])).rows).toEqual([{path: first}]);

    await identity('authenticated', admin);
    await db.query("select moderate_student_recommendation($1,'approved','rejected')", [second]);
    await identity('authenticated', alice);
    expect((await db.query('select remove_my_student_recommendation($1) as removed', [first])).rows).toEqual([{removed: true}]);
    await identity('anon');
    expect((await db.query('select * from list_student_recommendations(null,$1)', [poi])).rows).toEqual([]);
    expect((await db.query('select * from discovery_poi_metadata(array[$1])', [poi])).rows[0]).toMatchObject({recommended: false});
    expect((await db.query('select student_recommendation_image($1) as path', [first])).rows).toEqual([{path: null}]);

    await identity('postgres');
    expect((await db.query('select id,place_id,content from reviews')).rows).toEqual([{id: historic, place_id: place, content: '历史评价'}]);
    expect((await db.query('select shop_id from favorites')).rows).toEqual([{shop_id: place}]);
    expect((await db.query('select place_id,storage_path from place_media')).rows)
      .toEqual([{place_id: place, storage_path: 'historic.jpg'}]);
    expect((await db.query('select id from places order by id')).rows).toEqual([{id: place}, {id: otherPlace}]);
  });

  it('keeps favorites after reauthentication and POI rotation and does not duplicate a mapped historical save', async () => {
    await identity('service_role');
    await Promise.all([
      db.query('select save_verified_discovery_favorite($1,$2,true)', [alice, poi]),
      db.query('select save_verified_discovery_favorite($1,$2,true)', [alice, poi])
    ]);
    await identity('authenticated', alice);
    const unmapped = (await db.query<{location_id: string}>('select location_id from list_my_discovery_favorites() where poi_id=$1', [poi])).rows;
    expect(unmapped).toHaveLength(1);
    await identity('authenticated', bob);
    expect((await db.query('select * from list_my_discovery_favorites()')).rows).toEqual([]);

    await identity('service_role');
    expect((await db.query('select associate_verified_discovery_poi($1,$2) as location_id', [poi, place])).rows)
      .toEqual(unmapped);
    expect((await db.query('select associate_verified_discovery_poi($1,null,$2) as location_id', [newPoi, poi])).rows)
      .toEqual(unmapped);
    await expect(db.query('select associate_verified_discovery_poi($1,$2)', [newPoi, otherPlace])).rejects.toThrow('Location already attached');
    await identity('anon');
    expect((await db.query('select * from discovery_poi_metadata(array[$1,$2]) order by poi_id', [poi, newPoi])).rows)
      .toMatchObject([{current_poi_id: newPoi, recommended: true}, {current_poi_id: newPoi, recommended: true}]);
    expect((await db.query('select * from list_student_recommendations(null,$1)', [newPoi])).rows).toMatchObject([{id: historic}]);
    await identity('authenticated', alice);
    expect((await db.query('select * from list_my_discovery_favorites()')).rows).toMatchObject([{place_id: place, poi_id: newPoi}]);

    await identity('service_role');
    await db.query('select save_verified_discovery_favorite($1,$2,true)', [alice, newPoi]);
    await identity('postgres');
    expect((await db.query('select shop_id from favorites')).rows).toEqual([{shop_id: place}]);
    expect((await db.query('select * from discovery_favorites')).rows).toEqual([]);
    expect((await db.query('select * from discovery_locations')).rows).toHaveLength(1);
    await expect(db.query('delete from places where id=$1', [place])).rejects.toThrow(/update or delete on table.*places/);
    await db.query("update places set status='archived' where id=$1", [place]);
    await identity('anon');
    expect((await db.query('select * from discovery_poi_metadata(array[$1])', [newPoi])).rows).toMatchObject([{available: false, recommended: false, place_id: null}]);
    expect((await db.query('select * from list_student_recommendations(null,$1)', [newPoi])).rows).toEqual([]);
  });
});
