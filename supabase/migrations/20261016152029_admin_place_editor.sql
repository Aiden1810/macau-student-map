begin;

alter table public.places add column if not exists search_keywords_manual text[] not null default '{}';
alter table public.place_submissions add column if not exists published_place_id uuid references public.places(id) on delete set null;

create or replace function public.refresh_place_search_keywords()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_id uuid := coalesce(new.place_id,old.place_id);
begin
  update public.places p set search_keywords=concat_ws(' ',
    (select string_agg(t.label_zh_mo||' '||t.label_en,' ' order by t.sort_order,t.slug)
     from public.place_tags pt join public.tags t on t.id=pt.tag_id and t.is_active where pt.place_id=v_id),
    array_to_string(p.search_keywords_manual,' ')) where p.id=v_id;
  return null;
end $$;

create or replace function public.set_manual_place_search_keywords()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.search_keywords:=concat_ws(' ',
    (select string_agg(t.label_zh_mo||' '||t.label_en,' ' order by t.sort_order,t.slug)
     from public.place_tags pt join public.tags t on t.id=pt.tag_id and t.is_active where pt.place_id=new.id),
    array_to_string(new.search_keywords_manual,' '));
  return new;
end $$;
create trigger places_manual_keywords before insert or update of search_keywords_manual on public.places
for each row execute function public.set_manual_place_search_keywords();
revoke all on function public.set_manual_place_search_keywords() from public,anon,authenticated;

create or replace function private.assert_place_editor_input(p_input jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_tags uuid[];
  v_count integer;
  v_lng double precision := (p_input->>'longitude')::double precision;
  v_lat double precision := (p_input->>'latitude')::double precision;
  v_allowed text[];
begin
  if jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in
    ('name','nameEn','address','categorySlug','region','longitude','latitude','pricePerPerson','tagIds','searchKeywords','status')) then
    raise exception 'Unsupported editor fields' using errcode='23514';
  end if;
  if coalesce(length(btrim(p_input->>'name')),0) not between 1 and 120
     or coalesce(length(p_input->>'nameEn'),0)>120 or coalesce(length(p_input->>'address'),0)>500
     or coalesce(p_input->>'categorySlug','') not in ('food','shopping','entertainment','service')
     or coalesce(p_input->>'status','') not in ('draft','published','archived')
     or (p_input->>'region' is not null and p_input->>'region' not in ('macau-peninsula','taipa','coloane','hengqin','zhuhai','other')) then
    raise exception 'Invalid place details' using errcode='23514';
  end if;
  if (v_lng is null)<>(v_lat is null) or
     (p_input->>'status'='published' and v_lng is null) or
     (v_lng is not null and (v_lng not between 113 and 114.2 or v_lat not between 21.8 and 22.6)) or
     ((p_input->>'pricePerPerson')::numeric not between 0 and 100000) then
    raise exception 'Invalid coordinates or price' using errcode='23514';
  end if;
  if coalesce(jsonb_typeof(p_input->'tagIds'),'null')<>'array' or
     coalesce(jsonb_typeof(p_input->'searchKeywords'),'null')<>'array' then
    raise exception 'Tags and keywords must be arrays' using errcode='23514';
  end if;
  select array_agg(distinct value::uuid) into v_tags from jsonb_array_elements_text(p_input->'tagIds');
  if coalesce(cardinality(v_tags),0) not between 1 and 8 or jsonb_array_length(p_input->'tagIds')>8 or
     jsonb_array_length(p_input->'searchKeywords')>8 or exists(
       select 1 from jsonb_array_elements(p_input->'searchKeywords') value
       where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 40) then
    raise exception 'Invalid tag or keyword count' using errcode='23514';
  end if;
  perform t.id from public.tags t where t.id=any(v_tags) for share;
  select count(*) into v_count from public.tags where id=any(v_tags) and is_active;
  if v_count<>cardinality(v_tags) then raise exception 'Missing or inactive tags' using errcode='23514'; end if;
  v_allowed:=case p_input->>'categorySlug'
    when 'food' then array['chinese-cuisine','portuguese-cuisine','cha-chaan-teng','hot-pot','western-cuisine','japanese-cuisine','korean-cuisine','barbecue','snack','fast-food','southeast-asian-cuisine','coffee','milk-tea','fruit-tea','bread','dessert','cake','burger','fried-chicken']
    when 'service' then array['printing','hair-salon','repair-service']
    when 'shopping' then array['clothing','electronics','supermarket']
    else array['karaoke','cinema','board-games','bar','murder-mystery'] end;
  if not exists(select 1 from public.tags where id=any(v_tags) and kind in ('category','cuisine','product')) or
     exists(select 1 from public.tags where id=any(v_tags) and kind in ('category','cuisine','product') and not(slug=any(v_allowed))) then
    raise exception 'Place category and tags conflict' using errcode='23514';
  end if;
end $$;
revoke all on function private.assert_place_editor_input(jsonb) from public,anon,authenticated;

create or replace function public.admin_save_place(p_place_id uuid,p_input jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid := coalesce(p_place_id,gen_random_uuid());
  v_actor uuid := (select auth.uid());
  v_before jsonb;
  v_keywords text[];
begin
  if v_actor is null or not private.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.assert_place_editor_input(p_input);
  if p_place_id is not null then
    select to_jsonb(p) into v_before from public.places p where id=p_place_id for update;
    if not found then raise exception 'Place not found' using errcode='P0002'; end if;
  end if;
  select coalesce(array_agg(word order by ordinal),'{}') into v_keywords from
    (select btrim(value) word,min(ordinality) ordinal from jsonb_array_elements_text(p_input->'searchKeywords') with ordinality group by btrim(value)) words;
  insert into public.places(id,name,name_en,address,category_slug,region,longitude,latitude,price_per_person,search_keywords_manual,status,created_by,published_at)
    values(v_id,btrim(p_input->>'name'),nullif(btrim(p_input->>'nameEn'),''),nullif(btrim(p_input->>'address'),''),
      p_input->>'categorySlug',p_input->>'region',(p_input->>'longitude')::double precision,(p_input->>'latitude')::double precision,
      (p_input->>'pricePerPerson')::numeric,v_keywords,p_input->>'status',v_actor,
      case when p_input->>'status'='published' then now() else null end)
    on conflict(id) do update set name=excluded.name,name_en=excluded.name_en,address=excluded.address,
      category_slug=excluded.category_slug,region=excluded.region,longitude=excluded.longitude,latitude=excluded.latitude,
      price_per_person=excluded.price_per_person,search_keywords_manual=excluded.search_keywords_manual,status=excluded.status,
      published_at=case when excluded.status='published' then coalesce(public.places.published_at,now()) else public.places.published_at end;
  delete from public.place_tags where place_id=v_id;
  insert into public.place_tags(place_id,tag_id) select v_id,value::uuid from jsonb_array_elements_text(p_input->'tagIds') on conflict do nothing;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,case when p_place_id is null then 'place.create' else 'place.edit' end,'place',v_id::text,
      jsonb_build_object('before',v_before,'after',p_input));
  return v_id;
end $$;
revoke all on function public.admin_save_place(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_place(uuid,jsonb) to authenticated;

create or replace function public.admin_publish_submission(p_submission_id uuid,p_expected_version integer,p_input jsonb,p_review_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_submission public.place_submissions%rowtype; v_id uuid; v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into v_submission from public.place_submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
  if v_submission.status='approved' and v_submission.published_place_id is not null then return v_submission.published_place_id; end if;
  if v_submission.status<>'pending' or v_submission.version<>p_expected_version then
    raise exception 'Submission changed or was already reviewed' using errcode='40001';
  end if;
  if p_input->>'status'<>'published' or coalesce(length(p_review_note),0)>1000 then
    raise exception 'Review must publish valid details' using errcode='23514';
  end if;
  v_id:=public.admin_save_place(null,p_input);
  update public.places set created_by=v_submission.submitted_by where id=v_id;
  update public.place_submissions set status='approved',published_place_id=v_id,
    reviewed_at=now(),reviewed_by=v_actor,review_note=nullif(btrim(p_review_note),''),version=version+1 where id=p_submission_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'submission.publish_edited','place_submission',p_submission_id::text,
      jsonb_build_object('place_id',v_id,'original',to_jsonb(v_submission),'published',p_input,'review_note',p_review_note));
  return v_id;
end $$;
revoke all on function public.admin_publish_submission(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_publish_submission(uuid,integer,jsonb,text) to authenticated;

-- Moderators must be able to remove private originals after a successful copy.
create policy canonical_submission_storage_admin_cleanup on storage.objects for delete to authenticated
using(bucket_id='submission-media' and private.current_user_is_admin());

commit;
