-- Behavioral integration checks. All fixture users, places and audits roll back.
begin;
do $test$
declare
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_submission uuid := gen_random_uuid();
  v_place uuid;
  v_again uuid;
  v_payload jsonb := jsonb_build_object(
    'name','管理员流程回滚测试','nameEn','Editor rollback test','address','氹仔',
    'categorySlug','food','region','taipa','longitude',113.56,'latitude',22.16,
    'pricePerPerson',80,'tagIds',jsonb_build_array('00000000-0000-0000-0000-000000000104'),
    'searchKeywords',jsonb_build_array('测试关键词'),'status','published'
  );
begin
  if to_regprocedure('public.admin_save_place(uuid,jsonb)') is null then
    raise exception 'Missing atomic admin place editor';
  end if;
  insert into auth.users(id,email) values (v_admin,v_admin||'@editor-test.invalid'),(v_member,v_member||'@editor-test.invalid');
  insert into public.profiles(id,role) values(v_admin,'admin'),(v_member,'member')
    on conflict(id) do update set role=excluded.role;
  perform set_config('request.jwt.claim.sub',v_member::text,true);
  begin
    perform public.admin_save_place(null,v_payload);
    raise exception 'Member unexpectedly wrote a place';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_publish_submission(v_submission,1,v_payload,null);
    raise exception 'Member unexpectedly approved a submission';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_remove_legacy_place_image(gen_random_uuid(),'https://example.invalid/photo.jpg');
    raise exception 'Member unexpectedly removed a legacy image';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  v_place := public.admin_save_place(null,v_payload);
  if not exists(select 1 from public.places where id=v_place and name_en='Editor rollback test' and search_keywords like '%测试关键词%') then
    raise exception 'Editorial fields or search keywords were not persisted';
  end if;
  update public.places set rating_average=4.5,review_count=8 where id=v_place;
  perform public.admin_save_place(v_place,v_payload||'{"address":"修改地址"}'::jsonb);
  if not exists(select 1 from public.places where id=v_place and rating_average=4.5 and review_count=8) then
    raise exception 'Editing reset user rating statistics';
  end if;
  begin
    perform public.admin_save_place(v_place,v_payload||'{"categorySlug":"service"}'::jsonb);
    raise exception 'Conflicting category unexpectedly accepted';
  exception when check_violation then null;
  end;
  insert into public.place_submissions(id,name,category_slug,longitude,latitude,tag_ids,status,submitted_by,version,submitted_at)
    values(v_submission,'用户原始名称','food',113.56,22.16,array['00000000-0000-0000-0000-000000000104'::uuid],'pending',v_member,2,now());
  begin
    perform public.admin_publish_submission(v_submission,1,v_payload,null);
    raise exception 'Stale review unexpectedly published';
  exception when serialization_failure then null;
  end;
  v_place := public.admin_publish_submission(v_submission,2,v_payload,'补充资料后发布');
  v_again := public.admin_publish_submission(v_submission,2,v_payload,null);
  if v_again<>v_place then raise exception 'Retry created a duplicate place'; end if;
  if not exists(select 1 from public.place_submissions where id=v_submission and name='用户原始名称' and submitted_by=v_member and status='approved' and published_place_id=v_place) then
    raise exception 'Original submission or publication link was lost';
  end if;
  if not exists(select 1 from public.places where id=v_place and name='管理员流程回滚测试' and created_by=v_member) then
    raise exception 'Edited publication or attribution was lost';
  end if;
  if not exists(select 1 from public.admin_audit_logs where action='submission.publish_edited' and entity_id=v_submission::text) then
    raise exception 'Missing moderation audit';
  end if;
  update public.places set legacy_image_urls=array['https://example.invalid/old.jpg'] where id=v_place;
  perform public.admin_remove_legacy_place_image(v_place,'https://example.invalid/old.jpg');
  if exists(select 1 from public.places where id=v_place and cardinality(legacy_image_urls)>0) then
    raise exception 'Legacy image remained visible after removal';
  end if;
end;
$test$;
rollback;
