begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- The admin form still uses the legacy shops table during the dual-read transition.
-- A table grant alone is not authorization: the INSERT policy checks the same
-- trusted profiles-based admin predicate used by UPDATE and DELETE.
alter table public.shops enable row level security;
grant insert on table public.shops to authenticated;
create policy legacy_shops_admin_insert
on public.shops for insert
to authenticated
with check ((select private.current_user_is_admin()));

commit;
