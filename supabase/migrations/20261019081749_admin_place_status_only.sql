-- Changes publication status only. Existing place facts and tag relations are untouched.
create or replace function private.admin_set_place_status(
  p_place_id uuid, p_status text, p_expected_updated_at timestamptz
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_place public.places%rowtype;
  v_tags jsonb;
begin
  if v_actor is null or not private.current_user_is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('published', 'archived') or p_expected_updated_at is null then
    raise exception 'Invalid status request' using errcode = '23514';
  end if;
  select * into v_place from public.places where id = p_place_id for update;
  if not found then raise exception 'Place not found' using errcode = 'P0002'; end if;
  if v_place.legacy_shop_id is not null then
    raise exception 'Use legacy editor for this place' using errcode = '23514';
  end if;
  -- A retry after a lost response is safe when the requested state already holds.
  if v_place.status = p_status then return 'unchanged'; end if;
  if v_place.updated_at is distinct from p_expected_updated_at then
    raise exception 'Place has changed; refresh first' using errcode = '40001';
  end if;
  if p_status = 'published' then
    select coalesce(jsonb_agg(tag_id order by tag_id), '[]'::jsonb) into v_tags
      from public.place_tags where place_id = p_place_id;
    perform private.assert_place_editor_input(jsonb_build_object(
      'name', v_place.name, 'nameEn', v_place.name_en, 'address', v_place.address,
      'categorySlug', v_place.category_slug, 'region', v_place.region,
      'longitude', v_place.longitude, 'latitude', v_place.latitude,
      'pricePerPerson', v_place.price_per_person, 'tagIds', v_tags,
      'searchKeywords', to_jsonb(coalesce(v_place.search_keywords_manual, '{}'::text[])), 'status', p_status
    ));
  end if;
  update public.places set status = p_status,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
    where id = p_place_id;
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(v_actor, case when p_status = 'published' then 'place.publish' else 'place.archive' end,
      'place', p_place_id::text, jsonb_build_object('beforeStatus', v_place.status, 'afterStatus', p_status));
  return 'updated';
end $$;

revoke all on function private.admin_set_place_status(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function private.admin_set_place_status(uuid, text, timestamptz) to authenticated;

-- Keep the elevated implementation outside the exposed API schema. Both layers
-- retain the caller's auth.uid(); the private implementation checks administrator role.
create or replace function public.admin_set_place_status(
  p_place_id uuid, p_status text, p_expected_updated_at timestamptz
)
returns text language sql security invoker set search_path = '' as $$
  select private.admin_set_place_status(p_place_id, p_status, p_expected_updated_at);
$$;

revoke all on function public.admin_set_place_status(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_set_place_status(uuid, text, timestamptz) to authenticated;
