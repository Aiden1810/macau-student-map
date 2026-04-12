-- Shop action events for analytics conversion/share/complaint tracking
-- Run in Supabase SQL Editor

create table if not exists public.shop_action_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  action_type text not null check (action_type in ('locate_click', 'share_click', 'complaint_submit')),
  session_id text null,
  user_id uuid null,
  source text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shop_action_events_shop_id_created_at
  on public.shop_action_events (shop_id, created_at desc);

create index if not exists idx_shop_action_events_action_type_created_at
  on public.shop_action_events (action_type, created_at desc);

alter table public.shop_action_events enable row level security;

-- Allow public inserts for lightweight event tracking

drop policy if exists shop_action_events_insert_public on public.shop_action_events;
create policy shop_action_events_insert_public
  on public.shop_action_events
  for insert
  to anon, authenticated
  with check (true);

-- Admin-only reads

drop policy if exists shop_action_events_select_admin on public.shop_action_events;
create policy shop_action_events_select_admin
  on public.shop_action_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
