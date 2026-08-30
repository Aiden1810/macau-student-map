-- Restrict legacy SECURITY DEFINER helpers to trusted server-side callers.
-- Trigger execution is unaffected by revoking direct EXECUTE from API roles.
do $migration$
begin
  if to_regprocedure('public.recompute_shop_rating(uuid)') is not null then
    execute 'revoke execute on function public.recompute_shop_rating(uuid) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.trg_comments_recompute_shop_rating()') is not null then
    execute 'revoke execute on function public.trg_comments_recompute_shop_rating() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$migration$;

-- Replace permissive legacy shop policies with the minimum compatibility
-- access still used by the application during the dual-read migration.
do $migration$
begin
  if to_regclass('public.shops') is null then
    return;
  end if;

  execute 'alter table public.shops enable row level security';
  execute 'revoke all privileges on table public.shops from public, anon, authenticated';
  execute 'grant select on table public.shops to anon, authenticated';
  execute 'grant update, delete on table public.shops to authenticated';

  execute 'drop policy if exists "Allow moderation update" on public.shops';
  execute 'drop policy if exists "Public can read approved shops" on public.shops';
  execute 'drop policy if exists "Public can submit pending shops" on public.shops';
  execute 'drop policy if exists admin_can_delete_shops on public.shops';
  execute 'drop policy if exists public_can_insert_shops on public.shops';
  execute 'drop policy if exists public_can_select_shops on public.shops';
  execute 'drop policy if exists public_can_update_shops on public.shops';
  execute 'drop policy if exists shops_insert_own_submissions on public.shops';
  execute 'drop policy if exists shops_select_own_submissions on public.shops';
  execute 'drop policy if exists shops_update_admin_only on public.shops';
  execute 'drop policy if exists "任何人都可以查看店铺" on public.shops';

  execute $policy$
    create policy legacy_shops_public_read_published
    on public.shops for select
    to anon, authenticated
    using (status in ('verified', 'approved'))
  $policy$;

  execute $policy$
    create policy legacy_shops_admin_read_all
    on public.shops for select
    to authenticated
    using ((select private.current_user_is_admin()))
  $policy$;

  execute $policy$
    create policy legacy_shops_admin_update
    on public.shops for update
    to authenticated
    using ((select private.current_user_is_admin()))
    with check ((select private.current_user_is_admin()))
  $policy$;

  execute $policy$
    create policy legacy_shops_admin_delete
    on public.shops for delete
    to authenticated
    using ((select private.current_user_is_admin()))
  $policy$;
end;
$migration$;
