# Database Migration Runbook

## Safety boundary

The canonical model is additive. It does not drop `shops`, `comments`, or their columns. Never run `supabase db reset --linked` against production because that command destroys remote data.

## Local validation on Windows

Prerequisites: Docker Desktop running, Node.js 20 or newer, and the project dependencies installed.

```powershell
npm ci
npx supabase --version
npx supabase start
npx supabase db reset --local
npx supabase test db --local
```

After the reset, run `scripts/canonical-data-health.sql` in local Studio at `http://127.0.0.1:54323`. The first five result sets must contain zero rows. The final result set is a count summary.

## Existing remote project adoption

1. Back up the remote database and Storage object inventory.
2. Create or select a staging Supabase project.
3. Link only the staging project and verify its project ref twice.
4. Pull any remote-only schema history before pushing this migration.
5. Preview the exact migration list, then apply it to staging.

```powershell
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase migration list --linked
npx supabase db push --dry-run
npx supabase db push
```

Do not use `--include-seed` outside local development. `supabase/seed.sql` contains fixtures, not production data.

## Required Storage buckets

Local buckets are declared in `supabase/config.toml`. Before production deployment, create these buckets through the Supabase Storage API or Dashboard:

- `submission-media`: private, 10 MiB maximum, JPEG/PNG/WebP.
- `place-media`: public, 10 MiB maximum, JPEG/PNG/WebP.

The migration installs `storage.objects` policies but does not directly edit Storage metadata. File moves and deletes must use the Storage API.

## Backfill behavior

- Existing `shops.id` becomes both `places.id` and `places.legacy_shop_id`.
- `verified` legacy shops become `published`; other statuses remain non-public drafts.
- Legacy tags are matched through `tag_aliases`; valid legacy `tag_ids` are preserved.
- Legacy image URLs are retained in `places.legacy_image_urls` until media records are migrated through the Storage API.
- No legacy row or column is deleted by this migration.

## Rollback

The application must remain able to read `shops` during the compatibility period. If staging checks fail, stop the application rollout and restore the database backup. Do not manually delete partially migrated Storage objects; compare the recorded `bucket_id/storage_path` inventory and remove them through the Storage API.
