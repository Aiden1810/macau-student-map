begin;

-- Keep tag validation inside the same transaction as moderation. Locking both
-- the submission and its current tag rows prevents a tag from being disabled
-- between validation and the place_tags insert.
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

create or replace function public.merge_place_submission(
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
  v_actor_id uuid := (select auth.uid());
  v_submitted_tag_count integer;
  v_active_tag_count integer;
begin
  if v_actor_id is null or not private.current_user_is_admin() then
    raise exception 'administrator permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.places where id = p_target_place_id and status = 'published') then
    raise exception 'target place not found' using errcode = 'P0002';
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

  insert into public.place_tags (place_id, tag_id)
  select p_target_place_id, t.id
  from public.tags t
  where t.id = any(v_submission.tag_ids) and t.is_active
  on conflict do nothing;

  update public.place_media
  set
    place_id = p_target_place_id,
    submission_id = null,
    lifecycle_status = 'ready'
  where submission_id = p_submission_id and bucket_id = 'place-media';

  update public.place_submissions
  set
    status = 'merged',
    merged_into_place_id = p_target_place_id,
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    review_note = nullif(btrim(p_review_note), ''),
    version = version + 1
  where id = p_submission_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'submission.merge',
    'place_submission',
    p_submission_id::text,
    jsonb_build_object('place_id', p_target_place_id, 'review_note', nullif(btrim(p_review_note), ''))
  );

  return p_target_place_id;
end;
$$;

revoke all on function public.approve_place_submission(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.merge_place_submission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_place_submission(uuid, uuid, text) to authenticated;
grant execute on function public.merge_place_submission(uuid, uuid, text) to authenticated;

commit;
