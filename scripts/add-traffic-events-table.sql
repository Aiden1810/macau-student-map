-- 网站流量监测表（轻量级）
-- 用于统计 PV/UV、最近活跃访客等基础指标

create table if not exists public.site_traffic_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'page_view',
  path text not null,
  locale text null,
  session_id text not null,
  user_id uuid null,
  user_agent text null,
  referrer text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_traffic_events_created_at
  on public.site_traffic_events (created_at desc);

create index if not exists idx_site_traffic_events_event_type_created_at
  on public.site_traffic_events (event_type, created_at desc);

create index if not exists idx_site_traffic_events_session_id_created_at
  on public.site_traffic_events (session_id, created_at desc);

alter table public.site_traffic_events enable row level security;

-- 允许所有访客写入页面浏览事件（只允许 insert）
drop policy if exists "site_traffic_events_insert_public" on public.site_traffic_events;
create policy "site_traffic_events_insert_public"
  on public.site_traffic_events
  for insert
  to anon, authenticated
  with check (true);

-- 仅管理员允许读取（后台统计）
drop policy if exists "site_traffic_events_select_admin" on public.site_traffic_events;
create policy "site_traffic_events_select_admin"
  on public.site_traffic_events
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