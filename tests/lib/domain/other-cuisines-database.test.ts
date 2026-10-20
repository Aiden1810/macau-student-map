import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {TAG_CATALOG} from '../../../lib/domain/taxonomy';

const db = new PGlite();
const migration = readFileSync('supabase/migrations/20261020163349_other_cuisines.sql', 'utf8');
const baseline = readFileSync('supabase/migrations/20260830103144_canonical_local_life_model.sql', 'utf8');
const editor = readFileSync('supabase/migrations/20261016152029_admin_place_editor.sql', 'utf8');
const india = '00000000-0000-0000-0000-000000000112';
const other = '00000000-0000-0000-0000-000000000113';
const southeast = '00000000-0000-0000-0000-000000000111';
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema private; create schema extensions;
    create table public.tags(id uuid primary key, slug text unique, kind text, label_zh_mo text, label_en text, sort_order integer, is_active boolean default true);
    create table public.tag_aliases(tag_id uuid references public.tags, alias text, normalized_alias text, locale text, weight numeric default 1, source text default 'catalog', unique(tag_id,normalized_alias,locale));
    create table public.places(id uuid primary key, name text, name_en text, address text, category_slug text, region text,
      longitude float8, latitude float8, price_per_person numeric, rating_average numeric, review_count integer default 0,
      confidence_score numeric default 0, status text, created_at timestamptz default now(), search_document tsvector default ''::tsvector);
    create table public.place_tags(place_id uuid references public.places, tag_id uuid references public.tags, primary key(place_id,tag_id));
    create function extensions.similarity(text,text) returns real language sql immutable as $$ select case when $1=$2 then 1.0 else 0.0 end::real $$;
    insert into public.tags(id,slug,kind,label_zh_mo,label_en,sort_order) values
      ('${southeast}','southeast-asian-cuisine','cuisine','東南亞菜','Southeast Asian cuisine',110),
      ('00000000-0000-0000-0000-000000000106','japanese-cuisine','cuisine','日料','Japanese cuisine',60);`);
  await db.exec(editor.match(/create or replace function private\.assert_place_editor_input[\s\S]*?revoke all on function private\.assert_place_editor_input[^;]+;/)![0]);
  await db.exec(baseline.match(/create or replace function public\.search_places\([\s\S]*?\n\$\$;/)![0]);
  await db.exec(migration);
}, 20000);
afterAll(async () => {await db.close();});

describe('other cuisine PostgreSQL migration', () => {
  it('keeps database UUIDs and labels identical to the shared application catalog', async () => {
    const result = await db.query<{id: string; slug: string; label_zh_mo: string; label_en: string}>(`select id,slug,label_zh_mo,label_en from public.tags where slug in ('indian-cuisine','other-cuisine','southeast-asian-cuisine') order by slug`);
    expect(result.rows).toEqual(TAG_CATALOG.filter(tag => ['indian-cuisine','other-cuisine','southeast-asian-cuisine'].includes(tag.slug))
      .sort((a,b) => a.slug.localeCompare(b.slug)).map(tag => ({id: tag.id, slug: tag.slug, label_zh_mo: tag.labelZhMO, label_en: tag.labelEn})));
  });
  it('accepts new cuisines in the real editor validator and preserves category rejection', async () => {
    const input = {name: '餐厅', categorySlug: 'food', longitude: 113.55, latitude: 22.16, status: 'published', tagIds: [india], searchKeywords: []};
    await expect(db.query('select private.assert_place_editor_input($1::jsonb)', [JSON.stringify(input)])).resolves.toBeDefined();
    await expect(db.query('select private.assert_place_editor_input($1::jsonb)', [JSON.stringify({...input,tagIds:[other]})])).resolves.toBeDefined();
    await expect(db.query('select private.assert_place_editor_input($1::jsonb)', [JSON.stringify({...input,categorySlug:'service'})])).rejects.toMatchObject({code:'23514'});
  });
  it('matches existing Southeast Asian rows through parent RPC filters and search aliases', async () => {
    await db.exec(`insert into public.places(id,name,category_slug,status) values
      ('10000000-0000-0000-0000-000000000001','A','food','published'),
      ('10000000-0000-0000-0000-000000000002','B','food','published'),
      ('10000000-0000-0000-0000-000000000003','C','food','published');
      insert into public.place_tags values
      ('10000000-0000-0000-0000-000000000001','${india}'),
      ('10000000-0000-0000-0000-000000000002','${southeast}'),
      ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000106');`);
    expect((await db.query(`select place_name from public.search_places(p_tag_ids=>array['${other}'::uuid]) order by place_name`)).rows).toEqual([{place_name:'A'},{place_name:'B'}]);
    expect((await db.query("select place_name from public.search_places(p_query=>'其他菜系') order by place_name")).rows).toEqual([{place_name:'A'},{place_name:'B'}]);
    expect((await db.query("select place_name from public.search_places(p_query=>'Indian food')")).rows).toEqual([{place_name:'A'}]);
  });
  it('is repeatable without altering place data or opening private validator permissions', async () => {
    const before = await db.query('select * from public.place_tags order by place_id');
    await db.exec(migration);
    expect((await db.query('select * from public.place_tags order by place_id')).rows).toEqual(before.rows);
    expect((await db.query("select has_function_privilege('anon','private.assert_place_editor_input(jsonb)','execute') as allowed")).rows).toEqual([{allowed:false}]);
  });
});
