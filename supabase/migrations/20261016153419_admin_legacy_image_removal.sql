begin;
create or replace function public.admin_remove_legacy_place_image(p_place_id uuid,p_url text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not private.current_user_is_admin() then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  perform id from public.places where id=p_place_id and legacy_shop_id is null for update;
  if not found then raise exception 'Place not found or requires legacy editor' using errcode='P0002'; end if;
  update public.places set legacy_image_urls=array_remove(legacy_image_urls,p_url) where id=p_place_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values((select auth.uid()),'place.image_remove','place',p_place_id::text,jsonb_build_object('legacy_url',p_url));
end $$;
revoke all on function public.admin_remove_legacy_place_image(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_remove_legacy_place_image(uuid,text) to authenticated;
commit;
