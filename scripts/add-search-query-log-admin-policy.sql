-- Protect search analytics: only administrators may read search_query_log.
-- Run this script in the Supabase SQL Editor after deploying the matching API change.

alter table if exists public.search_query_log enable row level security;

do $$
declare
  existing_policy text;
begin
  if to_regclass('public.search_query_log') is null then
    raise exception 'public.search_query_log does not exist';
  end if;

  -- Replace every existing read policy so legacy public SELECT access cannot remain.
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'search_query_log'
      and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.search_query_log', existing_policy);
  end loop;
end
$$;

create policy search_query_log_select_admin
  on public.search_query_log
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
