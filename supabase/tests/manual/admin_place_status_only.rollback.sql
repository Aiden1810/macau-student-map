-- Run after the status-only migration. Uses existing accounts, disposable test
-- places, and a single rolled-back transaction. Does not change real stores.
begin;
do $$
declare
  v_admin uuid;
  v_member uuid;
  v_id uuid := gen_random_uuid();
  v_invalid uuid := gen_random_uuid();
  v_tag uuid;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  select u.id into v_member from auth.users u left join public.profiles p on p.id = u.id
    where p.role is distinct from 'admin' limit 1;
  select id into v_tag from public.tags where slug = 'chinese-cuisine' and is_active;
  if v_admin is null or v_member is null or v_tag is null then
    raise exception 'Existing admin, member and food tag are required';
  end if;
  perform set_config('test.bulk.admin', v_admin::text, true);
  perform set_config('test.bulk.member', v_member::text, true);
  perform set_config('test.bulk.id', v_id::text, true);
  perform set_config('test.bulk.invalid', v_invalid::text, true);
  insert into public.places(id, name, category_slug, longitude, latitude, price_per_person, status, created_by)
    values(v_id, '临时批量状态校验-事务回滚', 'food', 113.55, 22.19, 31, 'draft', v_admin),
      (v_invalid, '临时缺坐标校验-事务回滚', 'food', null, null, 31, 'draft', v_admin);
  insert into public.place_tags(place_id, tag_id) values(v_id, v_tag), (v_invalid, v_tag);
end $$;

set local role authenticated;
do $$
declare
  v_id uuid := current_setting('test.bulk.id')::uuid;
  v_invalid uuid := current_setting('test.bulk.invalid')::uuid;
  v_updated timestamptz;
  v_first timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bulk.admin'), 'role', 'authenticated')::text, true);
  select updated_at, to_jsonb(p) - array['status','published_at','updated_at'] into v_updated, v_before
    from public.places p where id = v_id;
  if public.admin_set_place_status(v_id, 'published', v_updated) <> 'updated' then raise exception 'Publish failed'; end if;
  select published_at, updated_at into v_first, v_updated from public.places where id = v_id;
  if v_first is null then raise exception 'First publication missing'; end if;
  if public.admin_set_place_status(v_id, 'published', v_updated - interval '1 second') <> 'unchanged' then
    raise exception 'Retry is not idempotent';
  end if;
  begin
    perform public.admin_set_place_status(v_id, 'archived', v_updated - interval '1 second');
    raise exception 'Stale write unexpectedly succeeded';
  exception when serialization_failure then null; end;
  if public.admin_set_place_status(v_id, 'archived', v_updated) <> 'updated' then raise exception 'Archive failed'; end if;
  select updated_at into v_updated from public.places where id = v_id;
  if public.admin_set_place_status(v_id, 'published', v_updated) <> 'updated' then raise exception 'Republish failed'; end if;
  if (select published_at from public.places where id = v_id) is distinct from v_first then
    raise exception 'Republish reset first publication';
  end if;
  select to_jsonb(p) - array['status','published_at','updated_at'] into v_after from public.places p where id = v_id;
  if v_before is distinct from v_after then raise exception 'Store facts changed'; end if;
  select count(*) into v_count from public.admin_audit_logs where entity_id = v_id::text;
  if v_count <> 3 then raise exception 'Expected one audit entry per actual change, got %', v_count; end if;
  begin
    perform public.admin_set_place_status(v_invalid, 'published', (select updated_at from public.places where id = v_invalid));
    raise exception 'Place without coordinates was published';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bulk.member'), 'role', 'authenticated')::text, true);
  begin
    perform public.admin_set_place_status(v_id, 'archived', v_updated);
    raise exception 'Member changed store status';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$
begin
  begin
    perform public.admin_set_place_status(current_setting('test.bulk.id')::uuid, 'archived', now());
    raise exception 'Anonymous caller executed administrative function';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Status-only permission, validation, audit and preservation checks passed; all test writes rolled back.' as verification;
