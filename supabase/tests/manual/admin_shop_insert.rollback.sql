-- Read-only outcome: all test rows and role settings are rolled back.
-- Requires an existing administrator in this project; never changes user roles.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

create temp table shop_insert_test_context as
select (select id from public.profiles where role = 'admin' limit 1) as admin_id,
       gen_random_uuid() as member_id, gen_random_uuid() as shop_id;
create temp table shop_insert_test_results (test text, passed boolean, detail text);
grant select on shop_insert_test_context to anon, authenticated;
grant insert on shop_insert_test_results to anon, authenticated;

do $$
begin
  if (select admin_id is null from shop_insert_test_context) then
    raise exception 'An existing admin is required; no user roles will be changed';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select admin_id from shop_insert_test_context), 'role', 'authenticated'
  )::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  inserted_id uuid;
begin
  begin
    insert into public.shops (id, name, category, shop_type, status, rating, total_sum, rating_count, tags)
    select shop_id, '__admin_insert_rollback_test__', 'service', '服务', 'verified', null, 0, 0, array['理发']
    from shop_insert_test_context
    returning id into inserted_id;
    insert into shop_insert_test_results values ('admin insert returning id', inserted_id is not null, null);
  exception when others then
    insert into shop_insert_test_results values ('admin insert returning id', false, SQLSTATE || ': ' || SQLERRM);
  end;
end;
$$;
reset role;

do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select member_id from shop_insert_test_context), 'role', 'authenticated',
    'user_metadata', jsonb_build_object('role', 'admin')
  )::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  begin
    insert into public.shops (name, category, status) values ('__member_insert_rollback_test__', 'service', 'verified');
    insert into shop_insert_test_results values ('non-admin cannot insert even with spoofed user metadata', false, null);
  exception when insufficient_privilege then
    insert into shop_insert_test_results values ('non-admin cannot insert even with spoofed user metadata', true, null);
  end;
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    insert into public.shops (name, category, status) values ('__anon_insert_rollback_test__', 'food', 'verified');
    insert into shop_insert_test_results values ('anonymous cannot insert', false, null);
  exception when insufficient_privilege then
    insert into shop_insert_test_results values ('anonymous cannot insert', true, null);
  end;
end;
$$;
reset role;
select * from shop_insert_test_results order by test;
rollback;
