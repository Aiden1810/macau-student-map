-- Add i18n fields for minimum multilingual scope
-- Scope: shop name, review text, tags

alter table public.shops
  add column if not exists name_i18n jsonb,
  add column if not exists review_text_i18n jsonb,
  add column if not exists tags_i18n jsonb;

-- Backfill from existing Chinese data
update public.shops
set
  name_i18n = coalesce(name_i18n, jsonb_build_object('zh-CN', coalesce(name, ''))),
  review_text_i18n = coalesce(review_text_i18n, jsonb_build_object('zh-CN', coalesce(review_text, ''))),
  tags_i18n = coalesce(tags_i18n, jsonb_build_object('zh-CN', coalesce(to_jsonb(tags), '[]'::jsonb)));

-- Optional shape checks for write safety
alter table public.shops
  drop constraint if exists shops_name_i18n_is_object,
  drop constraint if exists shops_review_text_i18n_is_object,
  drop constraint if exists shops_tags_i18n_is_object;

alter table public.shops
  add constraint shops_name_i18n_is_object
  check (name_i18n is null or jsonb_typeof(name_i18n) = 'object'),
  add constraint shops_review_text_i18n_is_object
  check (review_text_i18n is null or jsonb_typeof(review_text_i18n) = 'object'),
  add constraint shops_tags_i18n_is_object
  check (tags_i18n is null or jsonb_typeof(tags_i18n) = 'object');

comment on column public.shops.name_i18n is 'Localized shop name, e.g. {"zh-CN":"...","en":"..."}';
comment on column public.shops.review_text_i18n is 'Localized review summary text';
comment on column public.shops.tags_i18n is 'Localized tags array by locale, e.g. {"zh-CN":[...],"en":[...]}';
