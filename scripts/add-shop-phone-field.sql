-- Add phone contact field for shop detail page
-- Safe to run multiple times

alter table if exists public.shops
add column if not exists phone text;

comment on column public.shops.phone is 'Shop contact phone number for detail page call action';

-- Optional index for phone search/admin filtering in future
create index if not exists idx_shops_phone on public.shops (phone);
