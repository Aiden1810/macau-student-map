-- Keep the existing API column and IDs, but allow favorites for every place.
-- Never recreate favorites: existing account saves and timestamps must survive.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

do $migration$
declare v_constraint record;
begin
  if to_regclass('public.shops') is not null then
    -- The initial backfill used identical IDs. Preserve favorites even if an
    -- older shop was added later and has not yet received its canonical row.
    insert into public.places(id, legacy_shop_id, name, address, category_slug, region,
      longitude, latitude, price_per_person, rating_average, review_count, legacy_image_urls, status, published_at)
      select s.id, s.id,
        coalesce(nullif(btrim(to_jsonb(s)->>'name'), ''), '未命名地點'),
        nullif(btrim(to_jsonb(s)->>'address'), ''),
        case lower(coalesce(to_jsonb(s)->>'category', 'food'))
          when 'shopping' then 'shopping' when 'entertainment' then 'entertainment'
          when 'service' then 'service' else 'food' end,
        nullif(btrim(to_jsonb(s)->>'region'), ''),
        case when coalesce(to_jsonb(s)->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (to_jsonb(s)->>'longitude')::double precision else null end,
        case when coalesce(to_jsonb(s)->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (to_jsonb(s)->>'latitude')::double precision else null end,
        case when coalesce(to_jsonb(s)->>'price_per_person', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (to_jsonb(s)->>'price_per_person')::numeric else null end,
        case when coalesce(to_jsonb(s)->>'rating', '') ~ '^[1-5]([.][0-9]+)?$'
          then least(5, (to_jsonb(s)->>'rating')::numeric) else null end,
        case when coalesce(to_jsonb(s)->>'review_count', '') ~ '^[0-9]+$'
          then (to_jsonb(s)->>'review_count')::integer
          when coalesce(to_jsonb(s)->>'rating_count', '') ~ '^[0-9]+$'
          then (to_jsonb(s)->>'rating_count')::integer else 0 end,
        case when jsonb_typeof(to_jsonb(s)->'image_urls')='array'
          then array(select jsonb_array_elements_text(to_jsonb(s)->'image_urls')) else '{}'::text[] end,
        case when to_jsonb(s)->>'status' in ('verified', 'approved') then 'published' else 'draft' end,
        case when to_jsonb(s)->>'status' in ('verified', 'approved') then now() else null end
      from public.shops s
      where exists (select 1 from public.favorites f where f.shop_id=s.id)
        and not exists (select 1 from public.places p where p.id=s.id or p.legacy_shop_id=s.id);

    for v_constraint in select conname from pg_catalog.pg_constraint
      where conrelid='public.favorites'::regclass and contype='f'
        and confrelid='public.shops'::regclass
    loop
      execute format('alter table public.favorites drop constraint %I', v_constraint.conname);
    end loop;
  end if;

  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid='public.favorites'::regclass and conname='favorites_place_id_fkey') then
    alter table public.favorites add constraint favorites_place_id_fkey
      foreign key (shop_id) references public.places(id) on delete cascade;
  end if;
end;
$migration$;

alter table public.favorites enable row level security;
revoke all on public.favorites from public, anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
drop policy if exists favorites_select_own on public.favorites;
drop policy if exists favorites_insert_own on public.favorites;
drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_select_own on public.favorites for select to authenticated
  using (auth.uid()=user_id);
create policy favorites_insert_own on public.favorites for insert to authenticated
  with check (auth.uid()=user_id);
create policy favorites_delete_own on public.favorites for delete to authenticated
  using (auth.uid()=user_id);
