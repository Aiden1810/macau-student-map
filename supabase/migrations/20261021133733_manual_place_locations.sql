-- Preserve unknown facts for existing places; manual locations carry finding directions.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.places add column if not exists location_details jsonb not null default '{}'::jsonb;
alter table public.place_submissions add column if not exists location_details jsonb not null default '{}'::jsonb;

-- Pure validation only; no access to user data or elevated privileges.
create or replace function public.valid_location_details(p_details jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb;
begin
  if jsonb_typeof(p_details) is distinct from 'object' then return false; end if;
  for k,v in select * from jsonb_each(p_details) loop
    if k in ('description','landmark','hours') then
      if jsonb_typeof(v) not in ('string','null') then return false; end if;
      if length(btrim(v#>>'{}')) > (case k when 'description' then 500 when 'landmark' then 120 else 200 end) then return false; end if;
    elsif k in ('source','businessForm','accuracy','mobility') then
      if jsonb_typeof(v)<>'string' then return false; end if;
      if not ((k='source' and v#>>'{}' in ('unknown','map','manual')) or
        (k='businessForm' and v#>>'{}' in ('unknown','store','stall')) or
        (k='accuracy' and v#>>'{}' in ('unknown','exact','approximate')) or
        (k='mobility' and v#>>'{}' in ('unknown','fixed','variable'))) then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_location_details(jsonb) from public;
grant execute on function public.valid_location_details(jsonb) to anon,authenticated,service_role;

alter table public.places add constraint places_location_details_valid check (
  public.valid_location_details(location_details) and
  (status<>'published' or location_details->>'source' is distinct from 'manual' or
    coalesce(length(btrim(location_details->>'description')),0)>0));
alter table public.place_submissions add constraint submissions_location_details_valid check (
  public.valid_location_details(location_details) and
  (status not in ('pending','approved') or location_details->>'source' is distinct from 'manual' or
    coalesce(length(btrim(location_details->>'description')),0)>0));

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
    ('name','nameEn','address','categorySlug','region','longitude','latitude','pricePerPerson','tagIds','searchKeywords','status','locationDetails')) then
    raise exception 'Unsupported editor fields' using errcode='23514';
  end if;
  if not public.valid_location_details(coalesce(p_input->'locationDetails','{}'::jsonb)) or
     (p_input->>'status'='published' and p_input->'locationDetails'->>'source'='manual'
      and coalesce(length(btrim(p_input->'locationDetails'->>'description')),0)=0) then
    raise exception 'Invalid location details or missing directions' using errcode='23514';
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
    when 'food' then array['chinese-cuisine','portuguese-cuisine','cha-chaan-teng','hot-pot','western-cuisine','japanese-cuisine','korean-cuisine','barbecue','snack','fast-food','southeast-asian-cuisine','indian-cuisine','other-cuisine','coffee','milk-tea','fruit-tea','bread','dessert','cake','burger','fried-chicken']
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
  insert into public.places(id,name,name_en,address,category_slug,region,longitude,latitude,price_per_person,search_keywords_manual,location_details,status,created_by,published_at)
    values(v_id,btrim(p_input->>'name'),nullif(btrim(p_input->>'nameEn'),''),nullif(btrim(p_input->>'address'),''),
      p_input->>'categorySlug',p_input->>'region',(p_input->>'longitude')::double precision,(p_input->>'latitude')::double precision,
      (p_input->>'pricePerPerson')::numeric,v_keywords,coalesce(p_input->'locationDetails','{}'::jsonb),p_input->>'status',v_actor,
      case when p_input->>'status'='published' then now() else null end)
    on conflict(id) do update set name=excluded.name,name_en=excluded.name_en,address=excluded.address,
      category_slug=excluded.category_slug,region=excluded.region,longitude=excluded.longitude,latitude=excluded.latitude,
      price_per_person=excluded.price_per_person,search_keywords_manual=excluded.search_keywords_manual,location_details=case when p_input ? 'locationDetails' then excluded.location_details else public.places.location_details end,status=excluded.status,
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

-- The original approval endpoint remains supported, with the same tag locks and authorization.
create or replace function public.approve_place_submission(
  p_submission_id uuid,
  p_target_place_id uuid,
  p_review_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.place_submissions%rowtype;
  v_place_id uuid;
  v_actor_id uuid := (select auth.uid());
  v_submitted_tag_count integer;
  v_active_tag_count integer;
begin
  if v_actor_id is null or not private.current_user_is_admin() then
    raise exception 'administrator permission required' using errcode = '42501';
  end if;

  if p_target_place_id is not null then
    raise exception 'use merge_place_submission for an existing place' using errcode = '22023';
  end if;

  select * into v_submission
  from public.place_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'submission is not pending' using errcode = '22023';
  end if;

  perform t.id
  from public.tags t
  where t.id = any(coalesce(v_submission.tag_ids, '{}'::uuid[]))
  for share;

  select count(*) into v_submitted_tag_count
  from (
    select distinct submitted_tag_id
    from unnest(coalesce(v_submission.tag_ids, '{}'::uuid[])) as submitted(submitted_tag_id)
  ) distinct_submitted_tags;

  select count(*) into v_active_tag_count
  from public.tags t
  where t.id = any(coalesce(v_submission.tag_ids, '{}'::uuid[]))
    and t.is_active;

  if v_submitted_tag_count = 0 or v_active_tag_count <> v_submitted_tag_count then
    raise exception 'submission tags are missing or inactive' using errcode = '23514';
  end if;

  v_place_id := gen_random_uuid();

  insert into public.places (
    id,
    name,
    address,
    location_details,
    category_slug,
    region,
    longitude,
    latitude,
    price_per_person,
    status,
    created_by,
    published_at
  ) values (
    v_place_id,
    v_submission.name,
    v_submission.address,
    v_submission.location_details,
    v_submission.category_slug,
    v_submission.region,
    v_submission.longitude,
    v_submission.latitude,
    v_submission.price_per_person,
    'published',
    v_submission.submitted_by,
    now()
  );

  insert into public.place_tags (place_id, tag_id)
  select v_place_id, t.id
  from public.tags t
  where t.id = any(v_submission.tag_ids) and t.is_active
  on conflict do nothing;

  update public.place_media
  set
    place_id = v_place_id,
    submission_id = null,
    lifecycle_status = 'ready'
  where submission_id = p_submission_id and bucket_id = 'place-media';

  update public.place_submissions
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    review_note = nullif(btrim(p_review_note), ''),
    version = version + 1
  where id = p_submission_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'submission.approve',
    'place_submission',
    p_submission_id::text,
    jsonb_build_object('place_id', v_place_id, 'review_note', nullif(btrim(p_review_note), ''))
  );

  return v_place_id;
end;
$$;
revoke all on function public.approve_place_submission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.approve_place_submission(uuid,uuid,text) to authenticated;

commit;
