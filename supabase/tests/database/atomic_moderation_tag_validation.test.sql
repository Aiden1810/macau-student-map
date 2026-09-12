-- Run only in a local/test database after migrations. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  position('for share' in lower(pg_get_functiondef('public.approve_place_submission(uuid,uuid,text)'::regprocedure))) > 0,
  'approve RPC locks tag rows during validation'
);
select ok(
  position('v_active_tag_count <> v_submitted_tag_count' in pg_get_functiondef('public.approve_place_submission(uuid,uuid,text)'::regprocedure)) > 0,
  'approve RPC rejects missing or inactive tags atomically'
);
select ok(
  position('for share' in lower(pg_get_functiondef('public.merge_place_submission(uuid,uuid,text)'::regprocedure))) > 0,
  'merge RPC locks tag rows during validation'
);
select ok(
  position('v_active_tag_count <> v_submitted_tag_count' in pg_get_functiondef('public.merge_place_submission(uuid,uuid,text)'::regprocedure)) > 0,
  'merge RPC rejects missing or inactive tags atomically'
);

select * from finish();
rollback;
