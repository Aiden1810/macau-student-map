-- Empty compatibility fixture for disposable local migration tests only.
-- The repository's 2026 migrations predate and assume this legacy relation.
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  category text,
  status text
);
