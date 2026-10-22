-- Real database integration checks. No test places, submissions, or audit rows survive.
begin;
do $$
declare
  v_actor uuid;
  v_tag uuid;
  v_place uuid;
  v_submission uuid;
  v_published uuid;
  v_input jsonb;
  v_details jsonb := '{"source":"manual","businessForm":"stall","accuracy":"approximate","mobility":"variable","description":"验证用：地标门口右侧","landmark":"验证用参考地标","hours":"通常晚上"}'::jsonb;
begin
  select id into v_actor from public.profiles where role='admin' limit 1;
  select id into v_tag from public.tags where slug='snack' and is_active;
  if v_actor is null or v_tag is null then raise exception 'Test requires an existing admin and active snack tag'; end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  v_input:=jsonb_build_object('name','__manual_location_rollback_test__','categorySlug','food','longitude',113.55,'latitude',22.16,
    'pricePerPerson',null,'tagIds',jsonb_build_array(v_tag),'searchKeywords','[]'::jsonb,'status','published','locationDetails',v_details);
  v_place:=public.admin_save_place(null,v_input);
  if (select location_details from public.places where id=v_place)<>v_details then raise exception 'Save lost location details'; end if;
  perform public.admin_save_place(v_place,v_input-'locationDetails');
  if (select location_details from public.places where id=v_place)<>v_details then raise exception 'Legacy client erased metadata'; end if;
  begin
    perform public.admin_save_place(null,jsonb_set(v_input,'{locationDetails}','{"source":"manual"}'::jsonb));
    raise exception 'Missing directions incorrectly accepted';
  exception when check_violation then null;
  end;
  insert into public.place_submissions(name,category_slug,longitude,latitude,tag_ids,status,submitted_by,location_details,submitted_at)
    values('__manual_location_rollback_test__','food',113.55,22.16,array[v_tag],'pending',v_actor,v_details,now()) returning id into v_submission;
  v_published:=public.admin_publish_submission(v_submission,1,v_input,null);
  if (select location_details from public.places where id=v_published)<>v_details then raise exception 'Edited publication lost location details'; end if;
  insert into public.place_submissions(name,category_slug,longitude,latitude,tag_ids,status,submitted_by,location_details,submitted_at)
    values('__manual_location_rollback_test__','food',113.55,22.16,array[v_tag],'pending',v_actor,v_details,now()) returning id into v_submission;
  v_published:=public.approve_place_submission(v_submission,null,null);
  if (select location_details from public.places where id=v_published)<>v_details then raise exception 'Original publication lost location details'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform public.admin_save_place(null,v_input);
    raise exception 'Non-admin incorrectly permitted';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('anon','public.admin_save_place(uuid,jsonb)','EXECUTE') then raise exception 'Anonymous admin RPC permission'; end if;
end $$;
rollback;
