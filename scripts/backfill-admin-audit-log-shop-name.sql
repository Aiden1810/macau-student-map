-- Backfill shop_name into admin_audit_logs.metadata for historical rows
-- Run in Supabase SQL Editor

begin;

update public.admin_audit_logs as logs
set metadata = coalesce(logs.metadata, '{}'::jsonb) || jsonb_build_object('shop_name', shops.name)
from public.shops as shops
where logs.target_shop_id = shops.id
  and shops.name is not null
  and btrim(shops.name) <> ''
  and (
    logs.metadata is null
    or coalesce(nullif(btrim(logs.metadata ->> 'shop_name'), ''), '') = ''
  );

commit;
