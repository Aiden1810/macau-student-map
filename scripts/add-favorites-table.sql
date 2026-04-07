-- Favorites table for authenticated users
-- Run this script in Supabase SQL Editor
-- NOTE: shops.id is uuid, so favorites.shop_id must also be uuid.

-- If you already created a wrong favorites table (e.g. shop_id text),
-- this will recreate it with correct column types.
drop table if exists public.favorites cascade;

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

alter table public.favorites enable row level security;

-- Some Postgres versions in Supabase do not support
-- "create policy if not exists", so use drop + create.
drop policy if exists favorites_select_own on public.favorites;
drop policy if exists favorites_insert_own on public.favorites;
drop policy if exists favorites_delete_own on public.favorites;

create policy favorites_select_own
  on public.favorites
  for select
  using (auth.uid() = user_id);

create policy favorites_insert_own
  on public.favorites
  for insert
  with check (auth.uid() = user_id);

create policy favorites_delete_own
  on public.favorites
  for delete
  using (auth.uid() = user_id);
