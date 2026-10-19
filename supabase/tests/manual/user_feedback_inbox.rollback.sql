-- Run after the feedback migration. Uses existing accounts as identities only.
-- All test feedback is isolated in one transaction and rolled back.
begin;

do $$
declare
  v_owner uuid;
  v_admin uuid;
begin
  select u.id into v_owner from auth.users u left join public.profiles p on p.id=u.id where p.role is distinct from 'admin' limit 1;
  select u.id into v_admin from auth.users u join public.profiles p on p.id=u.id where p.role='admin' limit 1;
  if v_owner is null or v_admin is null then raise exception 'Existing regular and administrator accounts are required for this rollback test'; end if;
  perform set_config('test.feedback.owner', v_owner::text, true);
  perform set_config('test.feedback.admin', v_admin::text, true);
  perform set_config('test.feedback.other', gen_random_uuid()::text, true);
  perform set_config('test.feedback.id', gen_random_uuid()::text, true);
end $$;

set local role authenticated;
do $$
declare v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.feedback.owner'), 'role', 'authenticated')::text, true);
  insert into public.user_feedback(id,user_id,category,place,message,reply_to,locale)
  values (current_setting('test.feedback.id')::uuid,auth.uid(),'issue','本地功能验收','这是反馈权限验收测试，事务结束后全部回滚。','','zh-CN');
  select count(*) into v_count from public.user_feedback where id=current_setting('test.feedback.id')::uuid;
  if v_count <> 1 then raise exception 'Owner cannot read own feedback'; end if;

  update public.user_feedback set status='resolved',handled_at=now(),handled_by=auth.uid() where id=current_setting('test.feedback.id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Regular user changed moderation status'; end if;

  begin
    insert into public.user_feedback(user_id,category,message,status)
    values(auth.uid(),'issue','这是一条试图伪造处理状态的测试内容。','resolved');
    raise exception 'Regular user wrote a protected status column';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_feedback(user_id,category,message)
    values(current_setting('test.feedback.other')::uuid,'issue','这是一条试图伪造其他用户身份的测试内容。');
    raise exception 'Regular user forged another owner';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.feedback.other'), 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.user_feedback where id=current_setting('test.feedback.id')::uuid;
  if v_count <> 0 then raise exception 'Another user read private feedback'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.feedback.admin'), 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.user_feedback where id=current_setting('test.feedback.id')::uuid;
  if v_count <> 1 then raise exception 'Administrator cannot read feedback'; end if;
  update public.user_feedback set status='resolved',handled_at=now(),handled_by=auth.uid() where id=current_setting('test.feedback.id')::uuid and status='pending';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Administrator cannot resolve feedback'; end if;
  update public.user_feedback set status='pending',handled_at=null,handled_by=null where id=current_setting('test.feedback.id')::uuid and status='resolved';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Administrator cannot reopen feedback'; end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.user_feedback limit 1;
    raise exception 'Anonymous visitor read feedback';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_feedback(category,message) values('issue','这是一条匿名越权提交的反馈测试内容。');
    raise exception 'Anonymous visitor submitted feedback';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
select 'Feedback RLS checks passed; all test writes rolled back.' as verification;
