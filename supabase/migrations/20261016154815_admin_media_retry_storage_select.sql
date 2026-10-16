-- Storage upsert and delete require SELECT in addition to the existing admin
-- INSERT/UPDATE/DELETE policies. Keep metadata access restricted to admins.
create policy canonical_place_storage_admin_select
on storage.objects for select to authenticated
using (bucket_id = 'place-media' and private.current_user_is_admin());
