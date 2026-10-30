begin;

-- The Data API and Storage API are directly reachable by signed-in users, so
-- attachment ownership and the draft boundary must be enforced in PostgreSQL.
create or replace function private.is_owned_draft_media_path(p_path text, p_submission_id uuid default null)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.place_submissions s
    where s.id::text = split_part(p_path, '/', 2)
      and (p_submission_id is null or s.id = p_submission_id)
      and s.submitted_by = (select auth.uid())
      and s.status = 'draft'
      and p_path ~ (
        '^' || (select auth.uid())::text || '/' || s.id::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
      )
  );
$$;
revoke all on function private.is_owned_draft_media_path(text, uuid) from public, anon, authenticated;
grant execute on function private.is_owned_draft_media_path(text, uuid) to authenticated;

drop policy if exists canonical_place_media_owner_insert on public.place_media;
create policy canonical_place_media_owner_insert on public.place_media for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and bucket_id = 'submission-media'
  and submission_id is not null
  and lifecycle_status = 'uploaded'
  and private.is_owned_draft_media_path(storage_path, submission_id)
);

drop policy if exists canonical_place_media_owner_update on public.place_media;
create policy canonical_place_media_owner_update on public.place_media for update to authenticated
using (
  uploaded_by = (select auth.uid())
  and submission_id is not null
  and exists (
    select 1 from public.place_submissions s
    where s.id = submission_id and s.submitted_by = (select auth.uid()) and s.status = 'draft'
  )
)
with check (
  uploaded_by = (select auth.uid())
  and bucket_id = 'submission-media'
  and submission_id is not null
  and lifecycle_status in ('uploaded', 'cleanup_pending', 'delete_failed')
  and private.is_owned_draft_media_path(storage_path, submission_id)
);

drop policy if exists canonical_place_media_owner_delete on public.place_media;
create policy canonical_place_media_owner_delete on public.place_media for delete to authenticated
using (
  uploaded_by = (select auth.uid())
  and submission_id is not null
  and exists (
    select 1 from public.place_submissions s
    where s.id = submission_id and s.submitted_by = (select auth.uid()) and s.status = 'draft'
  )
);

-- RLS validates the new row, while this trigger also compares it with the old
-- row so an owner cannot reassign an attachment to another of their drafts.
create or replace function private.keep_submission_media_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.current_user_is_admin()
    and row(new.id, new.place_id, new.submission_id, new.uploaded_by, new.bucket_id,
      new.storage_path, new.mime_type, new.byte_size, new.width, new.height, new.created_at)
    is distinct from
      row(old.id, old.place_id, old.submission_id, old.uploaded_by, old.bucket_id,
        old.storage_path, old.mime_type, old.byte_size, old.width, old.height, old.created_at)
  then
    raise exception 'Submission image identity cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_submission_media_identity() from public, anon, authenticated;
drop trigger if exists place_media_keep_submission_identity on public.place_media;
create trigger place_media_keep_submission_identity before update on public.place_media
for each row execute function private.keep_submission_media_identity();

drop policy if exists canonical_submission_storage_insert on storage.objects;
create policy canonical_submission_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-media'
  and private.is_owned_draft_media_path(name)
);

drop policy if exists canonical_submission_storage_update on storage.objects;
create policy canonical_submission_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'submission-media'
  and owner_id = (select auth.uid())::text
  and private.is_owned_draft_media_path(name)
)
with check (
  bucket_id = 'submission-media'
  and owner_id = (select auth.uid())::text
  and private.is_owned_draft_media_path(name)
);

drop policy if exists canonical_submission_storage_delete on storage.objects;
create policy canonical_submission_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'submission-media'
  and owner_id = (select auth.uid())::text
  and private.is_owned_draft_media_path(name)
);

commit;
