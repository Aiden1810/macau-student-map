-- Historical entry point retained to prevent accidental destructive setup.
-- Use the versioned, data-preserving migration instead:
-- supabase/migrations/20261022160000_canonical_favorites.sql
-- It keeps existing saves, supports canonical-only places, and installs RLS.
do $$ begin
  raise notice 'Favorites setup is versioned. Apply migration 20261022160000_canonical_favorites.sql; no tables or saves were changed.';
end $$;
