begin;

set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- A public Storage bucket bypasses read RLS. Stop rather than leaving review
-- attachments publicly accessible or moving/deleting existing files in SQL.
do $$
begin
  if not exists (select 1 from storage.buckets where id='submission-media' and public=false) then
    raise exception 'Review attachments require a private submission-media bucket';
  end if;
  if exists (select 1 from public.review_media where bucket_id <> 'submission-media') then
    raise exception 'Review attachments in public storage must be preserved and quarantined before this migration';
  end if;
end $$;
alter table public.review_media drop constraint review_media_bucket_check;
alter table public.review_media add constraint review_media_bucket_check
  check (bucket_id = 'submission-media');

-- Review RPCs lock the place before writing reviews. Keep that order and
-- allow ordinary place reads while the backfill runs.
lock table public.places in exclusive mode;

drop policy if exists canonical_reviews_public_read on public.reviews;
create policy canonical_reviews_public_read on public.reviews for select to anon, authenticated
  using (status='published' and moderation_status='approved' and deleted_at is null and exists (
    select 1 from public.places p where p.id=place_id and p.status='published'
  ));

drop policy if exists canonical_review_media_public_read on public.review_media;
create policy canonical_review_media_public_read on public.review_media for select to anon,authenticated
  using (exists(select 1 from public.reviews r join public.places p on p.id=r.place_id
    where r.id=review_id and r.status='published' and r.moderation_status='approved' and r.deleted_at is null and p.status='published'));

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
    from public.reviews where place_id=v_place_id and status='published' and moderation_status='approved' and deleted_at is null;
  update public.places set rating_average=v_average,review_count=v_count,
    confidence_score=public.calculate_confidence_score(v_average,v_count) where id=v_place_id;
  return null;
end $$;
revoke all on function private.refresh_place_review_rating() from public,anon,authenticated;
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
      status='pending',
      moderation_status='pending',moderation_reason=null,moderated_by=null,moderated_at=null
      where id=v_review.id returning * into v_review;
  else
    insert into public.reviews(place_id,user_id,rating,content,status,moderation_status)
      values(v_place_id,v_actor,p_rating,v_content,'pending','pending') returning * into v_review;
  end if;
  insert into private.review_write_limits(user_id,last_write_at) values(v_actor,clock_timestamp())
    on conflict(user_id) do update set last_write_at=excluded.last_write_at;
  return to_jsonb(v_review);
end $$;

-- Preserve IDs and content. Recompute each affected place once; ordinary
-- writes remain blocked by the transactional DDL lock on reviews.
alter table public.reviews disable trigger reviews_refresh_place_rating;
with affected as (
  update public.reviews set status='pending'
  where status='published' and moderation_status='pending'
  returning place_id
), totals as (
  select affected_places.place_id, avg(r.rating)::numeric(3,2) as average,
    count(r.id)::integer as review_count
  from (select distinct place_id from affected) affected_places
  left join public.reviews r on r.place_id=affected_places.place_id
    and r.status='published' and r.moderation_status='approved' and r.deleted_at is null
  group by affected_places.place_id
)
update public.places p
set rating_average=totals.average, review_count=totals.review_count,
  confidence_score=public.calculate_confidence_score(totals.average,totals.review_count)
from totals where p.id=totals.place_id;
alter table public.reviews enable trigger reviews_refresh_place_rating;

alter table public.reviews add constraint reviews_publication_requires_approval
  check (status <> 'published' or moderation_status = 'approved');

notify pgrst, 'reload schema';
commit;
