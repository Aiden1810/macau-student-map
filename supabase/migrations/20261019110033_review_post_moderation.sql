-- Post-publication moderation: pending moderation is initially public; rejected
-- reviews stay hidden through edits, soft deletion and reposting until approved.
alter table public.reviews
  add column moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  add column moderation_reason text check (length(moderation_reason) <= 1000),
  add column moderated_by uuid references auth.users(id) on delete set null,
  add column moderated_at timestamptz,
  add column deleted_at timestamptz;
create index reviews_moderation_queue_idx on public.reviews(moderation_status, updated_at desc) where deleted_at is null;

create table private.review_write_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_write_at timestamptz not null
);
alter table private.review_write_limits enable row level security;
revoke all on private.review_write_limits from public, anon, authenticated;

-- No client, including an administrator, can bypass the version checks, moderation
-- transitions or rate limit with a direct table write.
revoke insert, update, delete on public.reviews from public, anon, authenticated;
drop policy if exists canonical_reviews_owner_insert on public.reviews;
drop policy if exists canonical_reviews_owner_update on public.reviews;
drop policy if exists canonical_reviews_owner_delete on public.reviews;
drop policy if exists canonical_reviews_admin_all on public.reviews;
create policy canonical_reviews_admin_read on public.reviews for select to authenticated
  using (private.current_user_is_admin());
drop policy if exists canonical_reviews_public_read on public.reviews;
create policy canonical_reviews_public_read on public.reviews for select to anon, authenticated
  using (status='published' and deleted_at is null and exists (
    select 1 from public.places p where p.id=place_id and p.status='published'
  ));

drop policy if exists canonical_review_media_public_read on public.review_media;
create policy canonical_review_media_public_read on public.review_media for select to anon,authenticated
  using (exists(select 1 from public.reviews r join public.places p on p.id=r.place_id
    where r.id=review_id and r.status='published' and r.deleted_at is null and p.status='published'));

-- The trigger can change only derived fields. It runs with database-owner
-- privileges so an ordinary reviewer does not need write access to place facts.
create or replace function private.refresh_place_review_rating()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_place_id uuid := coalesce(new.place_id,old.place_id);
  v_average numeric;
  v_count integer;
begin
  perform 1 from public.places where id=v_place_id for update;
  select avg(rating)::numeric(3,2),count(*)::integer into v_average,v_count
    from public.reviews where place_id=v_place_id and status='published' and deleted_at is null;
  update public.places set rating_average=v_average,review_count=v_count,
    confidence_score=public.calculate_confidence_score(v_average,v_count) where id=v_place_id;
  return null;
end $$;
revoke all on function private.refresh_place_review_rating() from public,anon,authenticated;
drop trigger if exists reviews_refresh_place_rating on public.reviews;
create trigger reviews_refresh_place_rating after insert or update or delete on public.reviews
  for each row execute function private.refresh_place_review_rating();
revoke all on function public.refresh_place_rating() from public,anon,authenticated;

create or replace function private.save_place_review(
  p_place_id uuid,p_rating integer,p_content text,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_place_id uuid;
  v_review public.reviews%rowtype;
  v_existing boolean;
  v_last_write timestamptz;
  v_content text := nullif(btrim(p_content),'');
begin
  if v_actor is null then raise exception 'Login required' using errcode='42501'; end if;
  if p_rating is null or p_rating not between 1 and 5 or length(v_content)>3000 then
    raise exception 'Invalid review' using errcode='23514';
  end if;
  -- Serialize writes per account, including the first-ever review.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text,41019));
  select id into v_place_id from public.places
    where (id=p_place_id or legacy_shop_id=p_place_id) and status='published'
    order by (id=p_place_id) desc limit 1 for update;
  if not found then raise exception 'Published place not found' using errcode='P0002'; end if;
  select * into v_review from public.reviews where user_id=v_actor and place_id=v_place_id for update;
  v_existing := found;
  if v_existing and v_review.deleted_at is null and v_review.rating=p_rating and v_review.content is not distinct from v_content then
    return to_jsonb(v_review); -- Retry after a lost response is safe.
  end if;
  if (v_existing and v_review.updated_at is distinct from p_expected_updated_at)
    or (not v_existing and p_expected_updated_at is not null) then
    raise exception 'Review changed; refresh first' using errcode='40001';
  end if;
  select last_write_at into v_last_write from private.review_write_limits where user_id=v_actor;
  if v_last_write>clock_timestamp()-interval '10 seconds' then
    raise exception 'Wait before submitting again' using errcode='54000';
  end if;
  if v_existing then
    update public.reviews set rating=p_rating,content=v_content,deleted_at=null,
      status=case when v_review.status='published' then 'published' else 'pending' end,
      moderation_status='pending',moderated_by=null,moderated_at=null
      where id=v_review.id returning * into v_review;
  else
    insert into public.reviews(place_id,user_id,rating,content,status,moderation_status)
      values(v_place_id,v_actor,p_rating,v_content,'published','pending') returning * into v_review;
  end if;
  insert into private.review_write_limits(user_id,last_write_at) values(v_actor,clock_timestamp())
    on conflict(user_id) do update set last_write_at=excluded.last_write_at;
  return to_jsonb(v_review);
end $$;

create or replace function private.delete_place_review(p_review_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_review public.reviews%rowtype; v_place_id uuid;
begin
  if v_actor is null then raise exception 'Login required' using errcode='42501'; end if;
  select place_id into v_place_id from public.reviews where id=p_review_id and user_id=v_actor;
  if not found then raise exception 'Owned review not found' using errcode='P0002'; end if;
  perform 1 from public.places where id=v_place_id for update;
  select * into v_review from public.reviews where id=p_review_id and user_id=v_actor for update;
  if not found then raise exception 'Owned review not found' using errcode='P0002'; end if;
  if v_review.deleted_at is not null then return to_jsonb(v_review); end if;
  if v_review.updated_at is distinct from p_expected_updated_at then
    raise exception 'Review changed; refresh first' using errcode='40001';
  end if;
  update public.reviews set deleted_at=clock_timestamp() where id=p_review_id returning * into v_review;
  return to_jsonb(v_review);
end $$;

create or replace function private.moderate_place_review(
  p_review_id uuid,p_decision text,p_reason text,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_review public.reviews%rowtype; v_place_id uuid; v_reason text:=nullif(btrim(p_reason),'');
begin
  if v_actor is null or not private.current_user_is_admin() then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') or length(v_reason)>1000
    or (p_decision='rejected' and coalesce(length(v_reason),0)<3) then
    raise exception 'Invalid moderation decision' using errcode='23514';
  end if;
  select place_id into v_place_id from public.reviews where id=p_review_id;
  if not found then raise exception 'Review not found' using errcode='P0002'; end if;
  perform 1 from public.places where id=v_place_id for update;
  select * into v_review from public.reviews where id=p_review_id for update;
  if not found or v_review.deleted_at is not null then raise exception 'Review not found' using errcode='P0002'; end if;
  if v_review.updated_at is distinct from p_expected_updated_at then
    raise exception 'Review changed; refresh first' using errcode='40001';
  end if;
  update public.reviews set moderation_status=p_decision,
    status=case when p_decision='approved' then 'published' else 'rejected' end,
    moderation_reason=case when p_decision='rejected' then v_reason else null end,
    moderated_by=v_actor,moderated_at=clock_timestamp()
    where id=p_review_id returning * into v_review;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,case when p_decision='approved' then 'review.approve' else 'review.reject' end,
      'review',p_review_id::text,jsonb_build_object('placeId',v_place_id,'reason',v_review.moderation_reason,'reviewUpdatedAt',p_expected_updated_at));
  return to_jsonb(v_review);
end $$;

-- Exposed wrappers never elevate privileges; private implementations validate the
-- caller themselves and are not exposed through the public Data API schema.
create or replace function public.save_place_review(p_place_id uuid,p_rating integer,p_content text,p_expected_updated_at timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_place_review(p_place_id,p_rating,p_content,p_expected_updated_at);
$$;
create or replace function public.delete_place_review(p_review_id uuid,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
  select private.delete_place_review(p_review_id,p_expected_updated_at);
$$;
create or replace function public.moderate_place_review(p_review_id uuid,p_decision text,p_reason text,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
  select private.moderate_place_review(p_review_id,p_decision,p_reason,p_expected_updated_at);
$$;
revoke all on function private.save_place_review(uuid,integer,text,timestamptz),private.delete_place_review(uuid,timestamptz),
  private.moderate_place_review(uuid,text,text,timestamptz),public.save_place_review(uuid,integer,text,timestamptz),
  public.delete_place_review(uuid,timestamptz),public.moderate_place_review(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function private.save_place_review(uuid,integer,text,timestamptz),private.delete_place_review(uuid,timestamptz),
  private.moderate_place_review(uuid,text,text,timestamptz),public.save_place_review(uuid,integer,text,timestamptz),
  public.delete_place_review(uuid,timestamptz),public.moderate_place_review(uuid,text,text,timestamptz) to authenticated;

-- Existing place facts and scores are not rewritten during installation. Future
-- review changes recompute only the affected place's derived rating fields.
notify pgrst, 'reload schema';
