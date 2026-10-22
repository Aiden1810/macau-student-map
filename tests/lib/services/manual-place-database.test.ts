import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const db = new PGlite();
const migration = readFileSync('supabase/migrations/20261021133733_manual_place_locations.sql', 'utf8');
const editor = readFileSync('supabase/migrations/20261016152029_admin_place_editor.sql', 'utf8');
const tag = '00000000-0000-0000-0000-000000000109';
const actor = '10000000-0000-0000-0000-000000000001';
const input = {name: '楼下烤冷面', categorySlug: 'food', longitude: 113.55, latitude: 22.16,
  tagIds: [tag], searchKeywords: [], status: 'published', locationDetails: {source: 'manual', businessForm: 'stall',
    accuracy: 'approximate', mobility: 'variable', description: '酒吧门口右边', landmark: '附近酒吧', hours: '一般晚上'}};

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    create function private.current_user_is_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
    create table public.tags(id uuid primary key,slug text,kind text,is_active boolean default true);
    create table public.places(id uuid primary key,name text,name_en text,address text,category_slug text,region text,
      longitude float8,latitude float8,price_per_person numeric,search_keywords_manual text[],status text,created_by uuid,published_at timestamptz);
    create table public.place_tags(place_id uuid references public.places,tag_id uuid references public.tags,primary key(place_id,tag_id));
    create table public.place_submissions(id uuid primary key,name text,address text,category_slug text,region text,longitude float8,latitude float8,
      price_per_person numeric,tag_ids uuid[],status text,submitted_by uuid,published_place_id uuid,version integer default 1,
      reviewed_at timestamptz,reviewed_by uuid,review_note text);
    create table public.place_media(place_id uuid,submission_id uuid,bucket_id text,lifecycle_status text);
    create table public.admin_audit_logs(actor_id uuid,action text,entity_type text,entity_id text,metadata jsonb);
    insert into public.tags values('${tag}','snack','cuisine',true);
    select set_config('test.actor','${actor}',false), set_config('test.admin','yes',false);`);
  await db.exec(editor.match(/create or replace function public\.admin_publish_submission[\s\S]*?grant execute on function public\.admin_publish_submission[^;]+;/)![0]);
  await db.exec(migration);
}, 20000);
afterAll(async () => {await db.close();});

describe('manual places in PostgreSQL', () => {
  it('saves and reloads location data without requiring a map platform ID', async () => {
    const saved = await db.query<{id: string}>('select public.admin_save_place(null,$1::jsonb) as id', [JSON.stringify(input)]);
    const row = await db.query('select name,location_details from public.places where id=$1', [saved.rows[0].id]);
    expect(row.rows).toEqual([{name: '楼下烤冷面', location_details: input.locationDetails}]);
    const {locationDetails: _details, ...legacyUpdate} = input;
    expect(_details).toBeDefined();
    await db.query('select public.admin_save_place($1,$2::jsonb)', [saved.rows[0].id, JSON.stringify({...legacyUpdate,name:'更新名称'})]);
    expect((await db.query('select location_details from public.places where id=$1', [saved.rows[0].id])).rows)
      .toEqual([{location_details: input.locationDetails}]);
  });
  it('rejects malformed metadata and directions missing at publication, including direct writes', async () => {
    for (const locationDetails of [{source:'manual'}, {businessForm:'invented'}, {accuracy:null}, {description:123}, {isOpen:true}]) {
      await expect(db.query('select public.admin_save_place(null,$1::jsonb)', [JSON.stringify({...input,locationDetails})]))
        .rejects.toMatchObject({code:'23514'});
    }
    await expect(db.exec(`insert into public.place_submissions(id,status,location_details) values(gen_random_uuid(),'pending','{"source":"manual"}')`))
      .rejects.toMatchObject({code:'23514'});
    await expect(db.exec(`insert into public.place_submissions(id,status,location_details) values(gen_random_uuid(),'draft','{"source":"manual"}')`)).resolves.toBeDefined();
  });
  it.each(['edited','original'])('retains metadata through %s approval', async path => {
    const created = await db.query<{id:string}>(`insert into public.place_submissions(id,name,category_slug,longitude,latitude,tag_ids,status,submitted_by,location_details)
      values(gen_random_uuid(),'楼下烤冷面','food',113.55,22.16,array['${tag}'::uuid],'pending','${actor}',$1::jsonb) returning id`, [JSON.stringify(input.locationDetails)]);
    const saved = path === 'edited'
      ? await db.query<{id:string}>('select public.admin_publish_submission($1,1,$2::jsonb,null) as id', [created.rows[0].id,JSON.stringify(input)])
      : await db.query<{id:string}>('select public.approve_place_submission($1,null,null) as id', [created.rows[0].id]);
    expect((await db.query('select location_details from public.places where id=$1',[saved.rows[0].id])).rows)
      .toEqual([{location_details:input.locationDetails}]);
  });
  it('keeps permission checks and legacy callers intact', async () => {
    await db.exec("select set_config('test.admin','no',false)");
    await expect(db.query('select public.admin_save_place(null,$1::jsonb)',[JSON.stringify(input)])).rejects.toMatchObject({code:'42501'});
    await db.exec("select set_config('test.admin','yes',false)");
    const {locationDetails: _details, ...legacy} = input;
    expect(_details).toBeDefined();
    await expect(db.query('select public.admin_save_place(null,$1::jsonb)',[JSON.stringify(legacy)])).resolves.toBeDefined();
    expect((await db.query("select has_function_privilege('anon','public.admin_save_place(uuid,jsonb)','execute') as allowed")).rows).toEqual([{allowed:false}]);
  });
});
