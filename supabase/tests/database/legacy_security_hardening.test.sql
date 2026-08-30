begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.recompute_shop_rating(uuid)'), 'EXECUTE'), false),
  'anonymous users cannot execute the legacy rating recompute function'
);
select ok(
  not coalesce(has_function_privilege('authenticated', to_regprocedure('public.recompute_shop_rating(uuid)'), 'EXECUTE'), false),
  'signed-in users cannot execute the legacy rating recompute function directly'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.trg_comments_recompute_shop_rating()'), 'EXECUTE'), false),
  'anonymous users cannot execute the legacy rating trigger function'
);
select ok(
  not coalesce(has_function_privilege('authenticated', to_regprocedure('public.trg_comments_recompute_shop_rating()'), 'EXECUTE'), false),
  'signed-in users cannot execute the legacy rating trigger function directly'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.rls_auto_enable()'), 'EXECUTE'), false),
  'anonymous users cannot execute the RLS event-trigger function'
);
select ok(
  not coalesce(has_function_privilege('authenticated', to_regprocedure('public.rls_auto_enable()'), 'EXECUTE'), false),
  'signed-in users cannot execute the RLS event-trigger function'
);

select ok(
  not coalesce(has_table_privilege('anon', to_regclass('public.shops'), 'INSERT'), false),
  'anonymous users have no direct shop insert grant'
);
select ok(
  not coalesce(has_table_privilege('anon', to_regclass('public.shops'), 'UPDATE'), false),
  'anonymous users have no direct shop update grant'
);
select ok(
  not coalesce(has_table_privilege('anon', to_regclass('public.shops'), 'DELETE'), false),
  'anonymous users have no direct shop delete grant'
);

select ok(
  to_regclass('public.shops') is null or exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'legacy_shops_public_read_published'
      and cmd = 'SELECT'
      and roles = '{anon,authenticated}'
  ),
  'legacy shops expose one explicit published-read policy'
);
select ok(
  to_regclass('public.shops') is null or (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname in (
        'legacy_shops_admin_read_all',
        'legacy_shops_admin_update',
        'legacy_shops_admin_delete'
      )
      and roles = '{authenticated}'
  ) = 3,
  'legacy shop read-all, update and delete policies are restricted to admins'
);

select * from finish();
rollback;
