
begin;
set local lock_timeout = '3s';

-- Hold identifiers only. Names, addresses, and coordinates are fetched on demand.
create table public.discovery_locations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid unique references public.places(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.discovery_poi_ids (
  poi_id text primary key check (poi_id ~ '^[A-Z0-9]{6,32}$'),
  location_id uuid not null references public.discovery_locations(id) on delete restrict,
  active boolean not null default true
);
create unique index discovery_one_active_poi on public.discovery_poi_ids(location_id) where active;

create table public.discovery_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.discovery_locations(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table public.student_recommendations (
  id uuid primary key,
  place_id uuid references public.places(id) on delete restrict,
  location_id uuid references public.discovery_locations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 3000),
  dishes text check (char_length(dishes) <= 200),
  amount numeric(9,2) check (amount between 0 and 100000),
  currency text check (currency in ('MOP', 'HKD', 'CNY', 'USD', 'OTHER')),
  amount_kind text check (amount_kind in ('per_person', 'total')),
  scene text check (char_length(scene) <= 100),
  image_path text unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (num_nonnulls(place_id, location_id) = 1),
  check (num_nonnulls(amount, currency, amount_kind) in (0, 3))
);
create index student_recommendations_public_places on public.student_recommendations(place_id, created_at desc, id desc)
  where status = 'approved' and deleted_at is null;
create index student_recommendations_public_locations on public.student_recommendations(location_id, created_at desc, id desc)
  where status = 'approved' and deleted_at is null;
create index student_recommendations_admin_queue on public.student_recommendations(created_at desc, id desc)
  where deleted_at is null and status = 'pending';

alter table public.discovery_locations enable row level security;
alter table public.discovery_poi_ids enable row level security;
alter table public.discovery_favorites enable row level security;
alter table public.student_recommendations enable row level security;
revoke all on public.discovery_locations, public.discovery_poi_ids, public.discovery_favorites, public.student_recommendations
  from public, anon, authenticated;

-- Each alias resolves to a stable internal identity. A lock on the exact ID
-- serializes concurrent first saves and first recommendations.
create function private.resolve_verified_discovery_poi(p_poi text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chengmi:poi:' || p_poi, 0));
  select i.location_id into v_id from public.discovery_poi_ids i where i.poi_id = p_poi;
  if found then return v_id; end if;
  insert into public.discovery_locations default values returning id into v_id;
  insert into public.discovery_poi_ids(poi_id, location_id) values (p_poi, v_id);
  return v_id;
end;
$$;
revoke all on function private.resolve_verified_discovery_poi(text) from public, anon, authenticated;



-- Only trusted operators call this after verifying both POIs refer to the
-- same business. Conflicting identities are left intact for manual review.
create function public.associate_verified_discovery_poi(p_poi text, p_place uuid, p_previous text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_location uuid; v_existing uuid; v_place uuid; v_key text;
begin
  if p_poi is null or p_poi !~ '^[A-Z0-9]{6,32}$' then raise exception 'Invalid POI'; end if;
  for v_key in select distinct k from unnest(array[p_poi, p_previous]) k where k is not null order by k loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chengmi:poi:' || v_key, 0));
  end loop;
  if p_previous is null then
    if p_place is null then raise exception 'Place or previous POI required'; end if;
    v_location := private.resolve_verified_discovery_poi(p_poi);
    if not exists (select 1 from public.discovery_poi_ids i where i.poi_id = p_poi and i.active)
      then raise exception 'Use the current POI for association'; end if;
  else
    select i.location_id into v_location from public.discovery_poi_ids i where i.poi_id = p_previous;
    if not found then raise exception 'Previous POI unavailable'; end if;
    select i.location_id into v_existing from public.discovery_poi_ids i where i.poi_id = p_poi;
    if found and v_existing <> v_location then raise exception 'POI belongs to a different location'; end if;
  end if;
  select l.place_id into v_place from public.discovery_locations l where l.id = v_location for update;
  if p_previous is not null then
    if not exists (select 1 from public.discovery_poi_ids i where i.poi_id = p_previous and i.active)
      and not exists (select 1 from public.discovery_poi_ids i where i.poi_id = p_poi and i.active)
      then raise exception 'Previous POI is not current'; end if;
    update public.discovery_poi_ids set active = false where location_id = v_location and active and poi_id <> p_poi;
    insert into public.discovery_poi_ids(poi_id, location_id) values (p_poi, v_location)
      on conflict (poi_id) do update set active = true;
  end if;
  if p_place is not null then
    if v_place is not null and v_place <> p_place then raise exception 'Location already attached'; end if;
    update public.discovery_locations set place_id = p_place where id = v_location;
    -- Keep the original account/place save and timestamp when both exist.
    insert into public.favorites(user_id, shop_id, created_at)
      select f.user_id, p_place, f.created_at from public.discovery_favorites f where f.location_id = v_location
      on conflict do nothing;
    delete from public.discovery_favorites where location_id = v_location;
  end if;
  return v_location;
end;
$$;

create function public.save_verified_discovery_favorite(p_actor uuid, p_poi text, p_saved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_place uuid;
begin
  if p_saved then
    v_id := private.resolve_verified_discovery_poi(p_poi);
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chengmi:poi:' || p_poi, 0));
    select i.location_id into v_id from public.discovery_poi_ids i where i.poi_id = p_poi;
  end if;
  select l.place_id into v_place from public.discovery_locations l where l.id = v_id for update;
  if p_saved then
    if exists (select 1 from public.places p where p.id = v_place and p.status <> 'published')
      then raise exception 'Place unavailable'; end if;
    if v_place is null then
      insert into public.discovery_favorites(user_id, location_id) values(p_actor, v_id) on conflict do nothing;
    else
      insert into public.favorites(user_id, shop_id) values(p_actor, v_place) on conflict do nothing;
    end if;
  else
    delete from public.favorites where shop_id = v_place and user_id = p_actor;
    delete from public.discovery_favorites where location_id = v_id and user_id = p_actor;
  end if;
  return p_saved;
end;
$$;

create function public.list_my_discovery_favorites(p_before timestamptz default null, p_before_id uuid default null)
returns table(location_id uuid, poi_id text, place_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with saves as (
  select f.location_id, a.poi_id, case when p.status = 'published' then p.id end as place_id, f.created_at
  from public.discovery_favorites f
  left join public.discovery_poi_ids a on a.location_id = f.location_id and a.active
  join public.discovery_locations l on l.id = f.location_id
  left join public.places p on p.id = l.place_id
  where f.user_id = (select auth.uid())
    and not exists (select 1 from public.favorites c where c.shop_id = l.place_id and c.user_id = f.user_id)
  union all
  select f.shop_id, a.poi_id, p.id, f.created_at
  from public.favorites f join public.places p on p.id = f.shop_id and p.status = 'published'
  left join public.discovery_locations l on l.place_id = f.shop_id
  left join public.discovery_poi_ids a on a.location_id = l.id and a.active
  where f.user_id = (select auth.uid())
  )
  select s.location_id, s.poi_id, s.place_id, s.created_at from saves s
  where p_before is null or (s.created_at, s.location_id) < (p_before, p_before_id)
  order by s.created_at desc, s.location_id desc limit 21
$$;

create function public.my_discovery_favorites_for_pois(p_ids text[])
returns setof text language sql stable security definer set search_path = '' as $$
  select i.poi_id from (select distinct id from unnest(coalesce(p_ids, '{}'::text[])) id limit 200) q
  join public.discovery_poi_ids i on i.poi_id = q.id
  join public.discovery_locations l on l.id = i.location_id
  where exists (select 1 from public.discovery_favorites f
      where f.location_id = l.id and f.user_id = (select auth.uid()))
    or exists (select 1 from public.favorites f
      where f.shop_id = l.place_id and f.user_id = (select auth.uid()))
$$;

create function public.submit_student_recommendation(
  p_actor uuid, p_id uuid, p_place uuid, p_poi text, p_reason text, p_dishes text,
  p_amount numeric, p_currency text, p_amount_kind text, p_scene text, p_has_image boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_location uuid; v_image text; v_existing public.student_recommendations%rowtype;
begin
  -- Idempotent retries use the same client draft ID, even after moderation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chengmi:recommendation:' || p_id::text, 0));
  select * into v_existing from public.student_recommendations where id = p_id;
  if found then
    if v_existing.user_id = p_actor and (
      (p_place is not null and v_existing.place_id = p_place) or
      (p_poi is not null and exists (select 1 from public.discovery_poi_ids i
        where i.poi_id = p_poi and i.location_id = v_existing.location_id))
    ) then return p_id; end if;
    raise exception 'Recommendation ID already in use';
  end if;
  if num_nonnulls(p_place, p_poi) <> 1 then raise exception 'One place is required'; end if;
  if p_place is not null then
    if not exists (select 1 from public.places p where p.id = p_place and p.status = 'published')
      then raise exception 'Place unavailable'; end if;
  else
    v_location := private.resolve_verified_discovery_poi(p_poi);
    if exists (select 1 from public.discovery_locations l join public.places p on p.id = l.place_id
      where l.id = v_location and p.status <> 'published') then raise exception 'Place unavailable'; end if;
  end if;
  if p_has_image then
    v_image := p_id::text;
    if not exists (select 1 from storage.objects where bucket_id = 'student-recommendation-media'
        and name = v_image and owner_id = p_actor::text) then raise exception 'Image unavailable'; end if;
  end if;
  insert into public.student_recommendations(id, place_id, location_id, user_id, reason, dishes, amount, currency, amount_kind, scene, image_path)
  values(p_id, p_place, v_location, p_actor, p_reason, p_dishes, p_amount, p_currency, p_amount_kind, p_scene, v_image);
  return p_id;
end;
$$;

create function private.public_student_recommendation(r public.student_recommendations)
returns boolean language sql stable security invoker set search_path = '' as $$
  select r.status = 'approved' and r.deleted_at is null and (
    r.place_id is not null and exists (select 1 from public.places p where p.id = r.place_id and p.status = 'published')
    or r.location_id is not null and exists (
      select 1 from public.discovery_locations l
      left join public.places p on p.id = l.place_id
      where l.id = r.location_id and (l.place_id is null or p.status = 'published')
    )
  )
$$;
revoke all on function private.public_student_recommendation(public.student_recommendations) from public, anon, authenticated;

-- The public RPCs expose specific columns and do not expose the author ID.
create function public.list_student_recommendations(
  p_place uuid default null, p_poi text default null, p_before timestamptz default null, p_before_id uuid default null
)
returns table(id uuid, reason text, dishes text, amount numeric, currency text, amount_kind text, scene text, image_path text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with target as (
    select l.id, l.place_id from public.discovery_locations l join public.discovery_poi_ids i on i.location_id = l.id
    where i.poi_id = p_poi
    union
    select l.id, l.place_id from public.discovery_locations l where l.place_id = p_place
  )
  select r.id, r.reason, r.dishes, r.amount, r.currency, r.amount_kind, r.scene,
    case when r.image_path is not null then r.id::text end, r.created_at
  from public.student_recommendations r
  where (r.place_id = p_place or r.place_id in (select t.place_id from target t) or r.location_id in (select t.id from target t))
    and r.status = 'approved' and r.deleted_at is null
    and private.public_student_recommendation(r)
    and (p_before is null or (r.created_at, r.id) < (p_before, p_before_id))
  order by r.created_at desc, r.id desc limit 21
$$;

create function public.discovery_poi_metadata(p_ids text[])
returns table(poi_id text, current_poi_id text, place_id uuid, available boolean, recommended boolean)
language sql stable security definer set search_path = '' as $$
  select i.poi_id, a.poi_id, case when p.status = 'published' then p.id end,
    (l.place_id is null or p.status = 'published'),
    (l.place_id is null or p.status = 'published') and (
      exists (select 1 from public.student_recommendations r where r.location_id = l.id and r.status = 'approved' and r.deleted_at is null)
      or exists (select 1 from public.student_recommendations r where r.place_id = p.id and r.status = 'approved' and r.deleted_at is null)
    )
  from (select distinct id from unnest(coalesce(p_ids, '{}'::text[])) id limit 200) q
  join public.discovery_poi_ids i on i.poi_id = q.id
  join public.discovery_locations l on l.id = i.location_id
  left join public.discovery_poi_ids a on a.location_id = l.id and a.active
  left join public.places p on p.id = l.place_id
$$;

create function public.discovery_catalog(
  p_bounds double precision[] default null, p_text text default null, p_offset integer default 0, p_city text default null
)
returns table(id uuid, name text, address text, latitude double precision, longitude double precision, recommended boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.address, p.latitude, p.longitude,
    exists (select 1 from public.student_recommendations r where r.place_id = p.id and r.status = 'approved' and r.deleted_at is null)
    or exists (select 1 from public.student_recommendations r
      join public.discovery_locations l on l.id = r.location_id
      where l.place_id = p.id and r.status = 'approved' and r.deleted_at is null)
  from public.places p
  where p.status = 'published' and p.category_slug = 'food'
    and p.latitude is not null and p.longitude is not null and (p.longitude <> 0 or p.latitude <> 0)
    and (p_bounds is null or (p.longitude between p_bounds[1] and p_bounds[3] and p.latitude between p_bounds[2] and p_bounds[4]))
    and (p_text is null or strpos(lower(concat_ws(' ', p.name, p.name_en, p.address, p.search_keywords_manual::text)), lower(left(p_text, 80))) > 0)
    and (p_city is null or strpos(lower(coalesce(p.address, '')), lower(regexp_replace(left(p_city, 80), '市$', ''))) > 0
      or (p_city in ('澳门', '澳門', '820000') and p.region in ('macau-peninsula', 'taipa', 'coloane'))
      or (p_city in ('珠海', '珠海市', '440400', '0756') and p.region in ('zhuhai', 'hengqin')))
  order by p.name, p.id offset greatest(0, least(p_offset, 2000)) limit 21
$$;

create function public.admin_student_recommendations(p_pending boolean, p_before timestamptz default null, p_before_id uuid default null)
returns table(id uuid, reason text, dishes text, amount numeric, currency text, amount_kind text, scene text, image_path text,
  created_at timestamptz, status text, place_id uuid, place_name text, poi_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(private.current_user_is_admin(), false) then raise exception 'Admin required' using errcode = '42501'; end if;
  return query select r.id, r.reason, r.dishes, r.amount, r.currency, r.amount_kind, r.scene,
    case when r.image_path is not null then r.id::text end, r.created_at, r.status,
    p.id, p.name, a.poi_id
  from public.student_recommendations r
  left join public.discovery_locations l on l.id = r.location_id
  left join public.places p on p.id = coalesce(r.place_id, l.place_id)
  left join public.discovery_poi_ids a on a.location_id = l.id and a.active
  where r.deleted_at is null and (not p_pending or r.status = 'pending')
    and (p_before is null or (r.created_at, r.id) < (p_before, p_before_id))
  order by r.created_at desc, r.id desc limit 21;
end;
$$;

create function public.moderate_student_recommendation(p_id uuid, p_expected text, p_decision text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.current_user_is_admin(), false) then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') or p_decision is null then raise exception 'Invalid decision'; end if;
  update public.student_recommendations
  set status = p_decision, moderated_at = now(), moderated_by = (select auth.uid())
  where id = p_id and status = p_expected and deleted_at is null;
  return found;
end;
$$;

create function public.remove_my_student_recommendation(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.student_recommendations set deleted_at = now()
  where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  return found;
end;
$$;

create function public.my_student_recommendations(p_place uuid, p_poi text)
returns table(id uuid, reason text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reason, r.status, r.created_at from public.student_recommendations r
  where r.user_id = (select auth.uid()) and r.deleted_at is null
    and (r.place_id = p_place
      or r.location_id in (select l.id from public.discovery_locations l where l.place_id = p_place)
      or r.location_id in (select i.location_id from public.discovery_poi_ids i where i.poi_id = p_poi)
    or r.place_id in (select l.place_id from public.discovery_poi_ids i
      join public.discovery_locations l on l.id = i.location_id where i.poi_id = p_poi))
  order by r.created_at desc, r.id desc limit 20
$$;

-- The bucket stays private. This RPC authorizes one image at a time. The
-- server signs the private path only after the viewer passes this check.
create function public.student_recommendation_image(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select r.image_path from public.student_recommendations r where r.id = p_id and r.deleted_at is null
    and (private.public_student_recommendation(r) or r.user_id = (select auth.uid()) or private.current_user_is_admin())
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('student-recommendation-media', 'student-recommendation-media', false, 1048576,
  array['image/jpeg', 'image/png', 'image/webp']);
create policy student_recommendation_upload_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-recommendation-media' and owner_id = (select auth.uid())::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

revoke all on function
  public.associate_verified_discovery_poi(text, uuid, text),
  public.save_verified_discovery_favorite(uuid, text, boolean),
  public.submit_student_recommendation(uuid, uuid, uuid, text, text, text, numeric, text, text, text, boolean),
  public.list_my_discovery_favorites(timestamptz, uuid), public.my_discovery_favorites_for_pois(text[]),
  public.admin_student_recommendations(boolean, timestamptz, uuid),
  public.moderate_student_recommendation(uuid, text, text),
  public.remove_my_student_recommendation(uuid), public.my_student_recommendations(uuid, text),
  public.list_student_recommendations(uuid, text, timestamptz, uuid), public.discovery_poi_metadata(text[]),
  public.discovery_catalog(double precision[], text, integer, text), public.student_recommendation_image(uuid)
from public, anon, authenticated;
grant execute on function public.associate_verified_discovery_poi(text, uuid, text),
  public.save_verified_discovery_favorite(uuid, text, boolean),
  public.submit_student_recommendation(uuid, uuid, uuid, text, text, text, numeric, text, text, text, boolean) to service_role;
grant execute on function public.list_my_discovery_favorites(timestamptz, uuid), public.my_discovery_favorites_for_pois(text[]),
  public.admin_student_recommendations(boolean, timestamptz, uuid),
  public.moderate_student_recommendation(uuid, text, text),
  public.remove_my_student_recommendation(uuid), public.my_student_recommendations(uuid, text) to authenticated;
grant execute on function public.list_student_recommendations(uuid, text, timestamptz, uuid),
  public.discovery_poi_metadata(text[]), public.discovery_catalog(double precision[], text, integer, text),
  public.student_recommendation_image(uuid) to anon, authenticated;
commit;
