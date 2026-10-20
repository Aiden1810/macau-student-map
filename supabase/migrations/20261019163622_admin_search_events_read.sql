-- The existing canonical_search_events_admin_read policy restricts rows to admins.
-- A SELECT policy alone does not grant table access. Do not grant anonymous reads.
grant select on table public.search_events to authenticated;
