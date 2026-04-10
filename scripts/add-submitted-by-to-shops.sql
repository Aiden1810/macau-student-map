-- Add submitted_by to shops for "My submissions" feature
-- Run this script in Supabase SQL Editor

-- 1) Schema: add column + index + FK
alter table public.shops
  add column if not exists submitted_by uuid;

create index if not exists shops_submitted_by_idx
  on public.shops (submitted_by);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shops_submitted_by_fkey'
      and conrelid = 'public.shops'::regclass
  ) then
    alter table public.shops
      add constraint shops_submitted_by_fkey
      foreign key (submitted_by)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

-- 2) RLS policies (safe, idempotent)
--    These only matter if RLS is enabled on public.shops.

-- Allow authenticated users to read their own submissions.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'shops_select_own_submissions'
  ) then
    create policy shops_select_own_submissions
      on public.shops
      for select
      to authenticated
      using (submitted_by = auth.uid());
  end if;
end $$;

-- Allow authenticated users to create submissions tied to themselves.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'shops_insert_own_submissions'
  ) then
    create policy shops_insert_own_submissions
      on public.shops
      for insert
      to authenticated
      with check (submitted_by = auth.uid() or submitted_by is null);
  end if;
end $$;
