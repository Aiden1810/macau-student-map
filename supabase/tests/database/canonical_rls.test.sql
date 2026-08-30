begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into public.place_categories (slug, label_zh_mo, label_en, sort_order)
values ('food', '美食', 'Food', 10)
on conflict (slug) do nothing;

insert into public.places (id, name, category_slug, status, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Visible Place', 'food', 'published', null),
  ('10000000-0000-0000-0000-000000000002', 'Hidden Draft', 'food', 'draft', null)
on conflict (id) do nothing;

set local role anon;

select results_eq(
  $$ select name from public.places order by name $$,
  $$ values ('Visible Place'::text) $$,
  'anonymous users only read published places'
);

select throws_ok(
  $$ insert into public.places (name, category_slug, status) values ('Anonymous Write', 'food', 'published') $$,
  '42501',
  null,
  'anonymous users cannot create places'
);

select throws_ok(
  $$ insert into public.place_submissions (name, category_slug, status) values ('Anonymous Submission', 'food', 'draft') $$,
  '42501',
  null,
  'anonymous users cannot create submissions'
);

reset role;

select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'place_submissions' and cmd = 'INSERT' and roles = '{authenticated}'),
  'authenticated submission insert policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'place_submissions' and cmd = 'UPDATE' and roles = '{authenticated}'),
  'authenticated submission update policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and cmd = 'INSERT' and roles = '{authenticated}'),
  'authenticated review insert policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and cmd = 'UPDATE' and roles = '{authenticated}'),
  'authenticated review update policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'place_media' and cmd = 'DELETE' and roles = '{authenticated}'),
  'authenticated media delete policy exists'
);
select ok(
  not exists(
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'place_submissions'
      and grantee = 'anon'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'anon has no submission write grants'
);

select * from finish();
rollback;
