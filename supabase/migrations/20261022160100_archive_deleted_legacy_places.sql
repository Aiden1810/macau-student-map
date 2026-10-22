-- A legacy deletion must hide the canonical copy in the same transaction.
-- Archive it instead of deleting review history or existing account favorites.
create or replace function private.archive_deleted_legacy_place()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.places set status='archived' where legacy_shop_id=old.id;
  return old;
end $$;
revoke all on function private.archive_deleted_legacy_place() from public, anon, authenticated;

do $migration$
begin
  if to_regclass('public.shops') is not null then
    -- Repair copies left visible by earlier legacy deletions as well.
    update public.places p set status='archived'
      where p.legacy_shop_id is not null and p.status<>'archived'
        and not exists (select 1 from public.shops s where s.id=p.legacy_shop_id);
    drop trigger if exists shops_archive_deleted_place on public.shops;
    create trigger shops_archive_deleted_place after delete on public.shops
      for each row execute function private.archive_deleted_legacy_place();
  end if;
end;
$migration$;
