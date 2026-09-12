-- Run only in a local/test database after migrations. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Exercise the actual legacy-table CHECK, without requiring other legacy columns.
create temporary table launch_category_fixture (category text);
do $$
declare definition text;
begin
  select pg_get_constraintdef(oid) into strict definition
  from pg_constraint where conrelid = 'public.shops'::regclass and conname = 'shops_category_check';
  execute 'alter table launch_category_fixture add constraint fixture_category_check ' || definition;
end $$;

select lives_ok($$ insert into launch_category_fixture values ('service'), ('entertainment'), ('shopping') $$,
  'admin can save canonical life categories');
select lives_ok($$ insert into launch_category_fixture values ('food'), ('drink'), ('vibe'), ('deal'), ('all'), (null) $$,
  'all legacy category values remain valid');
select throws_ok($$ insert into launch_category_fixture values ('not-a-category') $$, '23514', null,
  'unknown categories still fail');

select lives_ok($$
  insert into public.places (id, name, category_slug, status, published_at) values
    ('29000000-0000-0000-0000-000000000001', 'Local test bar', 'entertainment', 'published', now()),
    ('29000000-0000-0000-0000-000000000002', 'Local test mystery', 'entertainment', 'published', now());
  insert into public.place_tags (place_id, tag_id) values
    ('29000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000704'),
    ('29000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000705');
$$, 'new types survive the foreign key used by approval');

set local role anon;
select results_eq($$
  select t.slug from public.place_tags pt join public.tags t on t.id = pt.tag_id
  where pt.place_id in ('29000000-0000-0000-0000-000000000001'::uuid, '29000000-0000-0000-0000-000000000002'::uuid)
  order by t.slug
$$, $$ values ('bar'::text), ('murder-mystery'::text) $$,
  'published type relations are visible to the public UI');
select results_eq($$
  select distinct t.slug from public.tag_aliases a join public.tags t on t.id = a.tag_id
  where a.normalized_alias in ('剧本杀', '劇本殺') order by t.slug
$$, $$ values ('murder-mystery'::text) $$,
  'mystery aliases never resolve to board games');
reset role;
select * from finish();
rollback;
