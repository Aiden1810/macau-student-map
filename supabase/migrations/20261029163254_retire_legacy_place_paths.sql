-- Finalize the already-empty legacy store without deleting historical tables.
-- Refuse other environments that still require an actual data migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Wait for earlier writes, then hold the empty-store precondition until commit.
lock table public.shops, public.places in share row exclusive mode;

do $$
declare v_constraint text;
begin
  if exists (select 1 from public.shops) then
    raise exception 'Legacy shops remain; migrate and verify them before retiring legacy access';
  end if;
  if exists (select 1 from public.places where legacy_shop_id is not null) then
    raise exception 'Unresolved legacy place links remain; audit them before retirement';
  end if;
  if to_regclass('public.shop_action_events') is not null then
    if exists (select 1 from public.shop_action_events e
      where not exists (select 1 from public.places p where p.id = e.shop_id)) then
      raise exception 'Legacy action references cannot be mapped to places';
    end if;
    for v_constraint in
      select c.conname from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attname = 'shop_id'
      where c.conrelid = 'public.shop_action_events'::regclass
        and c.contype = 'f' and c.conkey = array[a.attnum]
    loop
      execute format('alter table public.shop_action_events drop constraint %I', v_constraint);
    end loop;
    alter table public.shop_action_events add constraint shop_action_events_place_id_fkey
      foreign key (shop_id) references public.places(id) on delete cascade;
  end if;
end $$;

-- Close legacy client writes. Keep empty-table SELECT available for an older
-- deployed detail page that still checks shops before falling back to places.
-- This keeps the database-first rollout and application rollback compatible.
revoke insert, update, delete, truncate, references, trigger on table public.shops
  from public, anon, authenticated;

commit;
