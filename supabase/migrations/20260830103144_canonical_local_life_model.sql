begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('member', 'admin'))
);

alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.place_categories (
  slug text primary key,
  label_zh_mo text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_categories_slug_format_check check (slug ~ '^[a-z][a-z0-9-]{1,39}$')
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null,
  label_zh_mo text not null,
  label_en text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_slug_format_check check (slug ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint tags_kind_check check (kind in ('category', 'cuisine', 'product', 'scene', 'facility', 'deal'))
);

create table if not exists public.tag_aliases (
  id bigint generated always as identity primary key,
  tag_id uuid not null references public.tags(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale text not null default 'zh-MO',
  weight numeric(4,3) not null default 1.000,
  source text not null default 'catalog',
  created_at timestamptz not null default now(),
  constraint tag_aliases_weight_check check (weight > 0 and weight <= 1),
  constraint tag_aliases_alias_not_blank_check check (length(btrim(alias)) > 0),
  constraint tag_aliases_unique unique (tag_id, normalized_alias, locale)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  legacy_shop_id uuid unique,
  name text not null,
  name_en text,
  address text,
  category_slug text not null references public.place_categories(slug),
  region text,
  longitude double precision,
  latitude double precision,
  price_per_person numeric(10,2),
  rating_average numeric(3,2),
  review_count integer not null default 0,
  confidence_score numeric(6,4),
  search_keywords text not null default '',
  legacy_image_urls text[] not null default '{}',
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(name, '') || ' ' ||
      coalesce(name_en, '') || ' ' ||
      coalesce(address, '') || ' ' ||
      coalesce(region, '') || ' ' ||
      coalesce(search_keywords, '')
    )
  ) stored,
  constraint places_name_not_blank_check check (length(btrim(name)) between 1 and 120),
  constraint places_status_check check (status in ('draft', 'published', 'archived')),
  constraint places_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint places_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint places_price_check check (price_per_person is null or price_per_person between 0 and 100000),
  constraint places_rating_check check (rating_average is null or rating_average between 1 and 5),
  constraint places_review_count_check check (review_count >= 0),
  constraint places_published_at_check check (status <> 'published' or published_at is not null)
);

create table if not exists public.place_tags (
  place_id uuid not null references public.places(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (place_id, tag_id)
);

create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  source_place_id uuid references public.places(id) on delete set null,
  merged_into_place_id uuid references public.places(id) on delete set null,
  name text not null,
  address text,
  category_slug text not null references public.place_categories(slug),
  region text,
  longitude double precision,
  latitude double precision,
  price_per_person numeric(10,2),
  tag_ids uuid[] not null default '{}',
  notes text,
  status text not null default 'draft',
  submitted_by uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_submissions_name_not_blank_check check (length(btrim(name)) between 1 and 120),
  constraint place_submissions_status_check check (status in ('draft', 'pending', 'approved', 'rejected', 'merged')),
  constraint place_submissions_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint place_submissions_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint place_submissions_price_check check (price_per_person is null or price_per_person between 0 and 100000),
  constraint place_submissions_tag_count_check check (cardinality(tag_ids) <= 20),
  constraint place_submissions_version_check check (version > 0),
  constraint place_submissions_pending_timestamp_check check (status <> 'pending' or submitted_at is not null)
);

create table if not exists public.place_media (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete cascade,
  submission_id uuid references public.place_submissions(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  alt_text text,
  sort_order integer not null default 0,
  lifecycle_status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_media_entity_check check ((place_id is null) <> (submission_id is null)),
  constraint place_media_bucket_check check (bucket_id in ('submission-media', 'place-media')),
  constraint place_media_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint place_media_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint place_media_lifecycle_check check (lifecycle_status in ('uploaded', 'ready', 'cleanup_pending', 'delete_failed')),
  constraint place_media_storage_object_unique unique (bucket_id, storage_path)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  content text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_content_length_check check (content is null or length(btrim(content)) between 1 and 3000),
  constraint reviews_status_check check (status in ('pending', 'published', 'rejected')),
  constraint reviews_user_place_unique unique (user_id, place_id)
);

create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'submission-media',
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint review_media_bucket_check check (bucket_id in ('submission-media', 'place-media')),
  constraint review_media_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint review_media_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint review_media_storage_object_unique unique (bucket_id, storage_path)
);

create table if not exists public.search_events (
  id bigint generated always as identity primary key,
  query text not null default '',
  normalized_query text not null default '',
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null,
  matched_level text not null default 'none',
  user_id uuid references auth.users(id) on delete set null,
  anon_session_hash text,
  created_at timestamptz not null default now(),
  constraint search_events_result_count_check check (result_count >= 0),
  constraint search_events_query_length_check check (length(query) <= 200),
  constraint search_events_matched_level_check check (matched_level in ('none', 'name', 'tag', 'alias', 'full_text', 'filter_only'))
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.admin_audit_logs add column if not exists action text;
alter table public.admin_audit_logs add column if not exists entity_type text;
alter table public.admin_audit_logs add column if not exists entity_id text;
alter table public.admin_audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.admin_audit_logs add column if not exists created_at timestamptz not null default now();
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;

create index if not exists tags_kind_active_idx on public.tags(kind, sort_order) where is_active;
create index if not exists tag_aliases_tag_id_idx on public.tag_aliases(tag_id);
create index if not exists tag_aliases_normalized_idx on public.tag_aliases(normalized_alias);
create index if not exists tag_aliases_normalized_trgm_idx on public.tag_aliases using gin (normalized_alias extensions.gin_trgm_ops);
create index if not exists places_category_status_idx on public.places(category_slug, status);
create index if not exists places_region_status_idx on public.places(region, status) where region is not null;
create index if not exists places_rating_status_idx on public.places(rating_average desc, review_count desc) where status = 'published';
create index if not exists places_created_by_idx on public.places(created_by) where created_by is not null;
create index if not exists places_search_document_idx on public.places using gin (search_document);
create index if not exists places_name_trgm_idx on public.places using gin (lower(name) extensions.gin_trgm_ops);
create index if not exists place_tags_tag_id_idx on public.place_tags(tag_id, place_id);
create index if not exists place_submissions_submitted_by_idx on public.place_submissions(submitted_by, created_at desc);
create index if not exists place_submissions_status_created_idx on public.place_submissions(status, created_at);
create index if not exists place_submissions_source_place_id_idx on public.place_submissions(source_place_id) where source_place_id is not null;
create index if not exists place_submissions_merged_into_idx on public.place_submissions(merged_into_place_id) where merged_into_place_id is not null;
create index if not exists place_media_place_id_idx on public.place_media(place_id, sort_order) where place_id is not null;
create index if not exists place_media_submission_id_idx on public.place_media(submission_id, sort_order) where submission_id is not null;
create index if not exists place_media_uploaded_by_idx on public.place_media(uploaded_by);
create index if not exists reviews_place_status_idx on public.reviews(place_id, status, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews(user_id, created_at desc);
create index if not exists review_media_review_id_idx on public.review_media(review_id, sort_order);
create index if not exists review_media_uploaded_by_idx on public.review_media(uploaded_by);
create index if not exists search_events_created_at_idx on public.search_events(created_at desc);
create index if not exists search_events_miss_idx on public.search_events(normalized_query, created_at desc) where result_count = 0;
create index if not exists search_events_user_id_idx on public.search_events(user_id) where user_id is not null;
create index if not exists admin_audit_logs_actor_created_idx on public.admin_audit_logs(actor_id, created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id, created_at desc);

insert into public.place_categories (slug, label_zh_mo, label_en, sort_order) values
  ('food', '美食', 'Food', 10),
  ('shopping', '購物', 'Shopping', 20),
  ('entertainment', '娛樂', 'Entertainment', 30),
  ('service', '生活服務', 'Services', 40)
on conflict (slug) do update set
  label_zh_mo = excluded.label_zh_mo,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.tags (id, slug, kind, label_zh_mo, label_en, sort_order) values
  ('00000000-0000-0000-0000-000000000101', 'chinese-cuisine', 'cuisine', '中餐', 'Chinese cuisine', 10),
  ('00000000-0000-0000-0000-000000000102', 'portuguese-cuisine', 'cuisine', '葡國菜', 'Portuguese cuisine', 20),
  ('00000000-0000-0000-0000-000000000103', 'cha-chaan-teng', 'category', '茶餐廳', 'Cha chaan teng', 30),
  ('00000000-0000-0000-0000-000000000104', 'hot-pot', 'category', '火鍋', 'Hot pot', 40),
  ('00000000-0000-0000-0000-000000000105', 'western-cuisine', 'cuisine', '西餐', 'Western cuisine', 50),
  ('00000000-0000-0000-0000-000000000106', 'japanese-cuisine', 'cuisine', '日料', 'Japanese cuisine', 60),
  ('00000000-0000-0000-0000-000000000107', 'korean-cuisine', 'cuisine', '韓餐', 'Korean cuisine', 70),
  ('00000000-0000-0000-0000-000000000108', 'barbecue', 'category', '烤肉', 'Barbecue', 80),
  ('00000000-0000-0000-0000-000000000109', 'snack', 'product', '小食', 'Snacks', 90),
  ('00000000-0000-0000-0000-000000000110', 'fast-food', 'category', '快餐', 'Fast food', 100),
  ('00000000-0000-0000-0000-000000000111', 'southeast-asian-cuisine', 'cuisine', '東南亞菜', 'Southeast Asian cuisine', 110),
  ('00000000-0000-0000-0000-000000000201', 'coffee', 'product', '咖啡', 'Coffee', 120),
  ('00000000-0000-0000-0000-000000000202', 'milk-tea', 'product', '奶茶', 'Milk tea', 130),
  ('00000000-0000-0000-0000-000000000203', 'fruit-tea', 'product', '果茶', 'Fruit tea', 140),
  ('00000000-0000-0000-0000-000000000301', 'bread', 'product', '麵包', 'Bread and bakery', 150),
  ('00000000-0000-0000-0000-000000000302', 'dessert', 'product', '甜品', 'Dessert', 160),
  ('00000000-0000-0000-0000-000000000303', 'cake', 'product', '蛋糕', 'Cake', 170),
  ('00000000-0000-0000-0000-000000000401', 'group-gathering', 'scene', '聚餐', 'Group dining', 180),
  ('00000000-0000-0000-0000-000000000403', 'photo-friendly', 'scene', '適合拍照', 'Photo friendly', 190),
  ('00000000-0000-0000-0000-000000000405', 'delivery', 'facility', '可外賣', 'Delivery available', 200),
  ('00000000-0000-0000-0000-000000000406', 'late-night', 'scene', '深夜營業', 'Open late', 210),
  ('00000000-0000-0000-0000-000000000501', 'burger', 'product', '漢堡', 'Burger', 220),
  ('00000000-0000-0000-0000-000000000502', 'fried-chicken', 'product', '炸雞', 'Fried chicken', 230),
  ('00000000-0000-0000-0000-000000000601', 'clothing', 'product', '服飾', 'Clothing', 240),
  ('00000000-0000-0000-0000-000000000602', 'electronics', 'product', '電子產品', 'Electronics', 250),
  ('00000000-0000-0000-0000-000000000603', 'supermarket', 'category', '超級市場', 'Supermarket', 260),
  ('00000000-0000-0000-0000-000000000701', 'karaoke', 'category', '卡拉 OK', 'Karaoke', 270),
  ('00000000-0000-0000-0000-000000000702', 'cinema', 'category', '電影院', 'Cinema', 280),
  ('00000000-0000-0000-0000-000000000703', 'board-games', 'category', '桌遊', 'Board games', 290),
  ('00000000-0000-0000-0000-000000000801', 'student-discount', 'deal', '學生優惠', 'Student discount', 300),
  ('00000000-0000-0000-0000-000000000901', 'printing', 'category', '打印影印', 'Printing', 310),
  ('00000000-0000-0000-0000-000000000902', 'hair-salon', 'category', '理髮美髮', 'Hair salon', 320),
  ('00000000-0000-0000-0000-000000000903', 'repair-service', 'category', '維修服務', 'Repair service', 330)
on conflict (id) do update set
  slug = excluded.slug,
  kind = excluded.kind,
  label_zh_mo = excluded.label_zh_mo,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  is_active = true;

with alias_source(tag_id, locale, aliases) as (
  values
    ('00000000-0000-0000-0000-000000000101'::uuid, 'zh-MO', array['中餐','中菜','粵菜','粤菜','飯','饭','粉面','粥店','粉面 / 粥店']),
    ('00000000-0000-0000-0000-000000000102'::uuid, 'zh-MO', array['葡國菜','葡国菜','葡餐']),
    ('00000000-0000-0000-0000-000000000103'::uuid, 'zh-MO', array['茶餐廳','茶餐厅','冰室','茶餐厅 / 冰室']),
    ('00000000-0000-0000-0000-000000000104'::uuid, 'zh-MO', array['火鍋','火锅','打邊爐','打边炉','火锅 / 焖锅']),
    ('00000000-0000-0000-0000-000000000105'::uuid, 'zh-MO', array['西餐','西餐 / 简餐']),
    ('00000000-0000-0000-0000-000000000106'::uuid, 'zh-MO', array['日料','日本菜','日本料理','壽司','寿司','日韩料理']),
    ('00000000-0000-0000-0000-000000000107'::uuid, 'zh-MO', array['韓餐','韩餐','韓式','韩式']),
    ('00000000-0000-0000-0000-000000000108'::uuid, 'zh-MO', array['烤肉','燒烤','烧烤','烧烤 / 烤肉']),
    ('00000000-0000-0000-0000-000000000109'::uuid, 'zh-MO', array['小食','小吃','街頭小食','街头小吃','牛杂','炸物 / 小食','牛杂 / 串串']),
    ('00000000-0000-0000-0000-000000000110'::uuid, 'zh-MO', array['快餐','速食','烧腊 / 快餐']),
    ('00000000-0000-0000-0000-000000000111'::uuid, 'zh-MO', array['東南亞菜','东南亚菜','泰餐','越南菜']),
    ('00000000-0000-0000-0000-000000000201'::uuid, 'zh-MO', array['咖啡','咖啡店','咖啡館','咖啡馆']),
    ('00000000-0000-0000-0000-000000000202'::uuid, 'zh-MO', array['奶茶','珍珠奶茶','波霸']),
    ('00000000-0000-0000-0000-000000000203'::uuid, 'zh-MO', array['果茶','水果茶','檸檬茶','柠檬茶']),
    ('00000000-0000-0000-0000-000000000301'::uuid, 'zh-MO', array['麵包','面包','烘焙','葡挞 / 烘焙']),
    ('00000000-0000-0000-0000-000000000302'::uuid, 'zh-MO', array['甜品','甜點','甜点','糖水','传统糖水','西式甜品']),
    ('00000000-0000-0000-0000-000000000303'::uuid, 'zh-MO', array['蛋糕']),
    ('00000000-0000-0000-0000-000000000401'::uuid, 'zh-MO', array['聚餐','團建','团建','聚會','聚会','🍻 聚餐 / 团建']),
    ('00000000-0000-0000-0000-000000000403'::uuid, 'zh-MO', array['適合拍照','适合拍照','拍照','出片','📸 拍照出片']),
    ('00000000-0000-0000-0000-000000000405'::uuid, 'zh-MO', array['可外賣','可外卖','外賣','外卖']),
    ('00000000-0000-0000-0000-000000000406'::uuid, 'zh-MO', array['深夜營業','深夜营业','宵夜','夜宵','🌙 深夜夜宵']),
    ('00000000-0000-0000-0000-000000000501'::uuid, 'zh-MO', array['漢堡','汉堡','汉堡 / 炸鸡']),
    ('00000000-0000-0000-0000-000000000502'::uuid, 'zh-MO', array['炸雞','炸鸡','汉堡 / 炸鸡']),
    ('00000000-0000-0000-0000-000000000601'::uuid, 'zh-MO', array['服飾','服饰','衣服','時裝','时装']),
    ('00000000-0000-0000-0000-000000000602'::uuid, 'zh-MO', array['電子產品','电子产品','數碼','数码','手機','手机']),
    ('00000000-0000-0000-0000-000000000603'::uuid, 'zh-MO', array['超級市場','超级市场','超市','便利店']),
    ('00000000-0000-0000-0000-000000000701'::uuid, 'zh-MO', array['卡拉 OK','卡拉ok','唱 K','唱k','KTV']),
    ('00000000-0000-0000-0000-000000000702'::uuid, 'zh-MO', array['電影院','电影院','戲院','戏院','電影','电影']),
    ('00000000-0000-0000-0000-000000000703'::uuid, 'zh-MO', array['桌遊','桌游','桌遊店','桌游店']),
    ('00000000-0000-0000-0000-000000000801'::uuid, 'zh-MO', array['學生優惠','学生优惠','學生折扣','学生折扣','學生價','学生价']),
    ('00000000-0000-0000-0000-000000000901'::uuid, 'zh-MO', array['打印','影印','複印','复印','打印店']),
    ('00000000-0000-0000-0000-000000000902'::uuid, 'zh-MO', array['理髮','理发','美髮','美发','髮型屋','发型屋']),
    ('00000000-0000-0000-0000-000000000903'::uuid, 'zh-MO', array['維修','维修','手機維修','手机维修','電腦維修','电脑维修']),
    ('00000000-0000-0000-0000-000000000102'::uuid, 'en', array['portuguese food']),
    ('00000000-0000-0000-0000-000000000104'::uuid, 'en', array['hotpot','hot pot']),
    ('00000000-0000-0000-0000-000000000106'::uuid, 'en', array['japanese food','sushi']),
    ('00000000-0000-0000-0000-000000000201'::uuid, 'en', array['coffee','cafe']),
    ('00000000-0000-0000-0000-000000000202'::uuid, 'en', array['milk tea','boba','bubble tea']),
    ('00000000-0000-0000-0000-000000000301'::uuid, 'en', array['bread','bakery']),
    ('00000000-0000-0000-0000-000000000302'::uuid, 'en', array['dessert','sweets']),
    ('00000000-0000-0000-0000-000000000501'::uuid, 'en', array['burger','burgers','hamburger']),
    ('00000000-0000-0000-0000-000000000502'::uuid, 'en', array['fried chicken']),
    ('00000000-0000-0000-0000-000000000601'::uuid, 'en', array['clothing','fashion']),
    ('00000000-0000-0000-0000-000000000602'::uuid, 'en', array['electronics','digital products']),
    ('00000000-0000-0000-0000-000000000603'::uuid, 'en', array['supermarket','convenience store']),
    ('00000000-0000-0000-0000-000000000701'::uuid, 'en', array['karaoke','ktv']),
    ('00000000-0000-0000-0000-000000000702'::uuid, 'en', array['cinema','movie theater']),
    ('00000000-0000-0000-0000-000000000703'::uuid, 'en', array['board games','board game cafe']),
    ('00000000-0000-0000-0000-000000000801'::uuid, 'en', array['student discount']),
    ('00000000-0000-0000-0000-000000000901'::uuid, 'en', array['printing','photocopy']),
    ('00000000-0000-0000-0000-000000000902'::uuid, 'en', array['hair salon','barber']),
    ('00000000-0000-0000-0000-000000000903'::uuid, 'en', array['repair','phone repair','computer repair'])
)
insert into public.tag_aliases (tag_id, alias, normalized_alias, locale, weight, source)
select tag_id, alias, lower(btrim(alias)), locale, 1.000, 'catalog'
from alias_source
cross join lateral unnest(aliases) as alias
on conflict (tag_id, normalized_alias, locale) do update set
  alias = excluded.alias,
  weight = excluded.weight,
  source = excluded.source;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists place_categories_set_updated_at on public.place_categories;
create trigger place_categories_set_updated_at before update on public.place_categories
for each row execute function public.set_updated_at();
drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();
drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at before update on public.places
for each row execute function public.set_updated_at();
drop trigger if exists place_submissions_set_updated_at on public.place_submissions;
create trigger place_submissions_set_updated_at before update on public.place_submissions
for each row execute function public.set_updated_at();
drop trigger if exists place_media_set_updated_at on public.place_media;
create trigger place_media_set_updated_at before update on public.place_media
for each row execute function public.set_updated_at();
drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at before update on public.reviews
for each row execute function public.set_updated_at();

create or replace function public.calculate_confidence_score(
  p_average numeric,
  p_count integer,
  p_global_average numeric default 4.0,
  p_prior_weight integer default 5
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_average is null or p_count <= 0 then null
    else round(
      ((p_count::numeric / (p_count + p_prior_weight)) * p_average) +
      ((p_prior_weight::numeric / (p_count + p_prior_weight)) * p_global_average),
      4
    )
  end;
$$;

create or replace function public.refresh_place_rating()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_place_id uuid := coalesce(new.place_id, old.place_id);
  v_average numeric;
  v_count integer;
begin
  select avg(rating)::numeric(3,2), count(*)::integer
  into v_average, v_count
  from public.reviews
  where place_id = v_place_id and status = 'published';

  update public.places
  set
    rating_average = case when v_count = 0 then null else v_average end,
    review_count = v_count,
    confidence_score = public.calculate_confidence_score(v_average, v_count)
  where id = v_place_id;

  return null;
end;
$$;

drop trigger if exists reviews_refresh_place_rating on public.reviews;
create trigger reviews_refresh_place_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_place_rating();

create or replace function public.refresh_place_search_keywords()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_place_id uuid := coalesce(new.place_id, old.place_id);
begin
  update public.places p
  set search_keywords = coalesce((
    select string_agg(t.label_zh_mo || ' ' || t.label_en, ' ' order by t.sort_order, t.slug)
    from public.place_tags pt
    join public.tags t on t.id = pt.tag_id
    where pt.place_id = v_place_id and t.is_active
  ), '')
  where p.id = v_place_id;

  return null;
end;
$$;

drop trigger if exists place_tags_refresh_search_keywords on public.place_tags;
create trigger place_tags_refresh_search_keywords
after insert or update or delete on public.place_tags
for each row execute function public.refresh_place_search_keywords();

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    );
$$;

revoke all on function private.current_user_is_admin() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

create or replace function public.approve_place_submission(
  p_submission_id uuid,
  p_target_place_id uuid,
  p_review_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.place_submissions%rowtype;
  v_place_id uuid;
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.current_user_is_admin() then
    raise exception 'administrator permission required' using errcode = '42501';
  end if;

  if p_target_place_id is not null then
    raise exception 'use merge_place_submission for an existing place' using errcode = '22023';
  end if;

  select * into v_submission
  from public.place_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'submission is not pending' using errcode = '22023';
  end if;

  v_place_id := gen_random_uuid();

  insert into public.places (
    id,
    name,
    address,
    category_slug,
    region,
    longitude,
    latitude,
    price_per_person,
    status,
    created_by,
    published_at
  ) values (
    v_place_id,
    v_submission.name,
    v_submission.address,
    v_submission.category_slug,
    v_submission.region,
    v_submission.longitude,
    v_submission.latitude,
    v_submission.price_per_person,
    'published',
    v_submission.submitted_by,
    now()
  );

  insert into public.place_tags (place_id, tag_id)
  select v_place_id, t.id
  from public.tags t
  where t.id = any(v_submission.tag_ids) and t.is_active
  on conflict do nothing;

  update public.place_media
  set
    place_id = v_place_id,
    submission_id = null,
    lifecycle_status = 'ready'
  where submission_id = p_submission_id and bucket_id = 'place-media';

  update public.place_submissions
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    review_note = nullif(btrim(p_review_note), ''),
    version = version + 1
  where id = p_submission_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'submission.approve',
    'place_submission',
    p_submission_id::text,
    jsonb_build_object('place_id', v_place_id, 'review_note', nullif(btrim(p_review_note), ''))
  );

  return v_place_id;
end;
$$;

create or replace function public.merge_place_submission(
  p_submission_id uuid,
  p_target_place_id uuid,
  p_review_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.place_submissions%rowtype;
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.current_user_is_admin() then
    raise exception 'administrator permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.places where id = p_target_place_id and status = 'published') then
    raise exception 'target place not found' using errcode = 'P0002';
  end if;

  select * into v_submission
  from public.place_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'submission is not pending' using errcode = '22023';
  end if;

  insert into public.place_tags (place_id, tag_id)
  select p_target_place_id, t.id
  from public.tags t
  where t.id = any(v_submission.tag_ids) and t.is_active
  on conflict do nothing;

  update public.place_media
  set
    place_id = p_target_place_id,
    submission_id = null,
    lifecycle_status = 'ready'
  where submission_id = p_submission_id and bucket_id = 'place-media';

  update public.place_submissions
  set
    status = 'merged',
    merged_into_place_id = p_target_place_id,
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    review_note = nullif(btrim(p_review_note), ''),
    version = version + 1
  where id = p_submission_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'submission.merge',
    'place_submission',
    p_submission_id::text,
    jsonb_build_object('place_id', p_target_place_id, 'review_note', nullif(btrim(p_review_note), ''))
  );

  return p_target_place_id;
end;
$$;

create or replace function public.reject_place_submission(
  p_submission_id uuid,
  p_review_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_updated_id uuid;
begin
  if v_actor_id is null or not private.current_user_is_admin() then
    raise exception 'administrator permission required' using errcode = '42501';
  end if;

  if nullif(btrim(p_review_note), '') is null then
    raise exception 'review note is required when rejecting' using errcode = '22023';
  end if;

  update public.place_submissions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    review_note = btrim(p_review_note),
    version = version + 1
  where id = p_submission_id and status = 'pending'
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'pending submission not found' using errcode = 'P0002';
  end if;

  update public.place_media
  set lifecycle_status = 'cleanup_pending'
  where submission_id = p_submission_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'submission.reject',
    'place_submission',
    p_submission_id::text,
    jsonb_build_object('review_note', btrim(p_review_note))
  );

  return v_updated_id;
end;
$$;

revoke all on function public.approve_place_submission(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.merge_place_submission(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reject_place_submission(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_place_submission(uuid, uuid, text) to authenticated;
grant execute on function public.merge_place_submission(uuid, uuid, text) to authenticated;
grant execute on function public.reject_place_submission(uuid, text) to authenticated;

create or replace function public.search_places(
  p_query text default '',
  p_category_slug text default null,
  p_tag_ids uuid[] default '{}'::uuid[],
  p_region text default null,
  p_price_max numeric default null,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_longitude double precision default null,
  p_latitude double precision default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  place_id uuid,
  place_name text,
  place_name_en text,
  place_address text,
  category_slug text,
  region text,
  longitude double precision,
  latitude double precision,
  price_per_person numeric,
  rating_average numeric,
  review_count integer,
  confidence_score numeric,
  matched_by text[],
  score double precision,
  distance_meters double precision,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select lower(btrim(coalesce(p_query, ''))) as q
  ),
  eligible as (
    select
      p.*,
      case
        when p_longitude is null or p_latitude is null or p.longitude is null or p.latitude is null then null
        else 111320.0 * sqrt(
          power((p.longitude - p_longitude) * cos(radians((p.latitude + p_latitude) / 2.0)), 2) +
          power(p.latitude - p_latitude, 2)
        )
      end as calculated_distance,
      case
        when i.q = '' then 0.0
        when lower(p.name) = i.q then 100.0
        when lower(p.name) like i.q || '%' then 80.0
        when lower(p.name) like '%' || i.q || '%' then 65.0
        else extensions.similarity(lower(p.name), i.q) * 55.0
      end as name_score,
      coalesce((
        select max(
          case
            when lower(t.label_zh_mo) = i.q or lower(t.label_en) = i.q then 60.0
            else 52.0
          end
        )
        from public.place_tags pt
        join public.tags t on t.id = pt.tag_id and t.is_active
        where pt.place_id = p.id
          and (
            lower(t.label_zh_mo) = i.q or
            lower(t.label_en) = i.q or
            lower(t.slug) = i.q
          )
      ), 0.0) as tag_score,
      coalesce((
        select max(50.0 * a.weight::double precision)
        from public.place_tags pt
        join public.tag_aliases a on a.tag_id = pt.tag_id
        where pt.place_id = p.id and a.normalized_alias = i.q
      ), 0.0) as alias_score,
      case
        when i.q <> '' and p.search_document @@ websearch_to_tsquery('simple'::regconfig, i.q) then 20.0
        else 0.0
      end as full_text_score,
      i.q
    from public.places p
    cross join input i
    where p.status = 'published'
      and (p_category_slug is null or p.category_slug = p_category_slug)
      and (p_region is null or p.region = p_region)
      and (p_price_max is null or p.price_per_person <= p_price_max)
      and (p_min_rating is null or p.rating_average >= p_min_rating)
      and not exists (
        select requested.kind
        from (
          select distinct t.kind
          from public.tags t
          where t.id = any(coalesce(p_tag_ids, '{}'::uuid[]))
        ) requested
        where not exists (
          select 1
          from public.place_tags selected_pt
          join public.tags selected_tag on selected_tag.id = selected_pt.tag_id
          where selected_pt.place_id = p.id
            and selected_tag.kind = requested.kind
            and selected_tag.id = any(coalesce(p_tag_ids, '{}'::uuid[]))
        )
      )
      and (
        i.q = '' or
        lower(p.name) = i.q or
        lower(p.name) like i.q || '%' or
        lower(p.name) like '%' || i.q || '%' or
        extensions.similarity(lower(p.name), i.q) >= 0.20 or
        p.search_document @@ websearch_to_tsquery('simple'::regconfig, i.q) or
        exists (
          select 1
          from public.place_tags query_pt
          join public.tags query_tag on query_tag.id = query_pt.tag_id and query_tag.is_active
          left join public.tag_aliases query_alias on query_alias.tag_id = query_tag.id
          where query_pt.place_id = p.id
            and (
              lower(query_tag.label_zh_mo) = i.q or
              lower(query_tag.label_en) = i.q or
              lower(query_tag.slug) = i.q or
              query_alias.normalized_alias = i.q
            )
        )
      )
  ),
  scored as (
    select
      e.*,
      greatest(e.name_score, e.tag_score, e.alias_score, e.full_text_score) +
        coalesce(e.confidence_score::double precision, 0.0) as relevance_score,
      array_remove(array[
        case
          when e.q = '' then 'filter_only'
          when lower(e.name) = e.q then 'name_exact'
          when lower(e.name) like e.q || '%' then 'name_prefix'
          when lower(e.name) like '%' || e.q || '%' then 'name_contains'
          else null
        end,
        case when e.tag_score > 0 then 'tag' else null end,
        case when e.alias_score > 0 then 'tag_alias' else null end,
        case when e.full_text_score > 0 then 'full_text' else null end
      ], null) as match_reasons
    from eligible e
  ),
  numbered as (
    select s.*, count(*) over () as result_total
    from scored s
  )
  select
    n.id,
    n.name,
    n.name_en,
    n.address,
    n.category_slug,
    n.region,
    n.longitude,
    n.latitude,
    n.price_per_person,
    n.rating_average,
    n.review_count,
    n.confidence_score,
    n.match_reasons,
    n.relevance_score,
    n.calculated_distance,
    n.result_total
  from numbered n
  order by
    case when p_sort = 'rating' then n.confidence_score end desc nulls last,
    case when p_sort = 'distance' then n.calculated_distance end asc nulls last,
    case when p_sort = 'newest' then n.created_at end desc nulls last,
    case when p_sort not in ('rating', 'distance', 'newest') then n.relevance_score end desc,
    n.confidence_score desc nulls last,
    n.id
  limit least(greatest(coalesce(p_page_size, 20), 1), 50)
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 50);
$$;

revoke all on function public.search_places(text, text, uuid[], text, numeric, numeric, text, double precision, double precision, integer, integer) from public;
grant execute on function public.search_places(text, text, uuid[], text, numeric, numeric, text, double precision, double precision, integer, integer) to anon, authenticated;

do $$
begin
  if to_regclass('public.shops') is not null then
    execute $backfill$
      insert into public.places (
        id,
        legacy_shop_id,
        name,
        address,
        category_slug,
        region,
        longitude,
        latitude,
        price_per_person,
        rating_average,
        review_count,
        confidence_score,
        legacy_image_urls,
        status,
        published_at,
        created_at,
        updated_at
      )
      select
        s.id,
        s.id,
        coalesce(nullif(btrim(to_jsonb(s)->>'name'), ''), '未命名地點'),
        nullif(btrim(to_jsonb(s)->>'address'), ''),
        case lower(coalesce(to_jsonb(s)->>'category', 'food'))
          when 'shopping' then 'shopping'
          when 'entertainment' then 'entertainment'
          when 'service' then 'service'
          else 'food'
        end,
        nullif(btrim(to_jsonb(s)->>'region'), ''),
        case
          when coalesce(to_jsonb(s)->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (to_jsonb(s)->>'longitude')::double precision
          else null
        end,
        case
          when coalesce(to_jsonb(s)->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (to_jsonb(s)->>'latitude')::double precision
          else null
        end,
        case
          when coalesce(to_jsonb(s)->>'price_per_person', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (to_jsonb(s)->>'price_per_person')::numeric
          else null
        end,
        case
          when coalesce(to_jsonb(s)->>'rating', '') ~ '^[1-5]([.][0-9]+)?$'
            then least(5, greatest(1, (to_jsonb(s)->>'rating')::numeric))
          else null
        end,
        case
          when coalesce(to_jsonb(s)->>'review_count', '') ~ '^[0-9]+$'
            then (to_jsonb(s)->>'review_count')::integer
          when coalesce(to_jsonb(s)->>'rating_count', '') ~ '^[0-9]+$'
            then (to_jsonb(s)->>'rating_count')::integer
          else 0
        end,
        public.calculate_confidence_score(
          case
            when coalesce(to_jsonb(s)->>'rating', '') ~ '^[1-5]([.][0-9]+)?$'
              then least(5, greatest(1, (to_jsonb(s)->>'rating')::numeric))
            else null
          end,
          case
            when coalesce(to_jsonb(s)->>'review_count', '') ~ '^[0-9]+$'
              then (to_jsonb(s)->>'review_count')::integer
            when coalesce(to_jsonb(s)->>'rating_count', '') ~ '^[0-9]+$'
              then (to_jsonb(s)->>'rating_count')::integer
            else 0
          end
        ),
        case
          when jsonb_typeof(to_jsonb(s)->'image_urls') = 'array'
            then array(select jsonb_array_elements_text(to_jsonb(s)->'image_urls'))
          else '{}'::text[]
        end,
        case when to_jsonb(s)->>'status' = 'verified' then 'published' else 'draft' end,
        case when to_jsonb(s)->>'status' = 'verified' then coalesce(nullif(to_jsonb(s)->>'created_at', '')::timestamptz, now()) else null end,
        coalesce(nullif(to_jsonb(s)->>'created_at', '')::timestamptz, now()),
        coalesce(nullif(to_jsonb(s)->>'updated_at', '')::timestamptz, now())
      from public.shops s
      on conflict (id) do nothing
    $backfill$;

    execute $tag_backfill$
      with legacy_tags as (
        select s.id as place_id, lower(btrim(value)) as normalized_alias
        from public.shops s
        cross join lateral jsonb_array_elements_text(
          case
            when jsonb_typeof(to_jsonb(s)->'tags') = 'array' then to_jsonb(s)->'tags'
            else '[]'::jsonb
          end
        ) as value
      ),
      legacy_tag_ids as (
        select s.id as place_id, value::uuid as tag_id
        from public.shops s
        cross join lateral jsonb_array_elements_text(
          case
            when jsonb_typeof(to_jsonb(s)->'tag_ids') = 'array' then to_jsonb(s)->'tag_ids'
            else '[]'::jsonb
          end
        ) as value
        where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      insert into public.place_tags (place_id, tag_id)
      select distinct lt.place_id, a.tag_id
      from legacy_tags lt
      join public.tag_aliases a on a.normalized_alias = lt.normalized_alias
      union
      select distinct lti.place_id, lti.tag_id
      from legacy_tag_ids lti
      join public.tags t on t.id = lti.tag_id
      on conflict do nothing
    $tag_backfill$;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.place_categories enable row level security;
alter table public.tags enable row level security;
alter table public.tag_aliases enable row level security;
alter table public.places enable row level security;
alter table public.place_tags enable row level security;
alter table public.place_submissions enable row level security;
alter table public.place_media enable row level security;
alter table public.reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.search_events enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.place_categories from anon, authenticated;
revoke all on public.tags from anon, authenticated;
revoke all on public.tag_aliases from anon, authenticated;
revoke all on public.places from anon, authenticated;
revoke all on public.place_tags from anon, authenticated;
revoke all on public.place_submissions from anon, authenticated;
revoke all on public.place_media from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.review_media from anon, authenticated;
revoke all on public.search_events from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.place_categories, public.tags, public.tag_aliases to anon, authenticated;
grant select on public.places, public.place_tags, public.place_media, public.reviews, public.review_media to anon, authenticated;
grant select, insert, update, delete on public.place_submissions to authenticated;
grant insert, update, delete on public.place_media, public.reviews, public.review_media to authenticated;
grant insert on public.search_events to anon, authenticated;
grant select, insert, update, delete on public.place_categories, public.tags, public.tag_aliases, public.places, public.place_tags to authenticated;
grant select, insert, update, delete on public.admin_audit_logs to authenticated;
grant usage, select on sequence public.tag_aliases_id_seq to authenticated;
grant usage, select on sequence public.search_events_id_seq to anon, authenticated;

grant all on public.profiles, public.place_categories, public.tags, public.tag_aliases, public.places,
  public.place_tags, public.place_submissions, public.place_media, public.reviews, public.review_media,
  public.search_events, public.admin_audit_logs to service_role;
grant all on sequence public.tag_aliases_id_seq, public.search_events_id_seq to service_role;

do $$
begin
  if to_regclass('public.admin_audit_logs_id_seq') is not null then
    grant usage, select on sequence public.admin_audit_logs_id_seq to authenticated, service_role;
  end if;
end;
$$;

drop policy if exists canonical_profiles_select on public.profiles;
create policy canonical_profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists canonical_profiles_admin_update on public.profiles;
create policy canonical_profiles_admin_update on public.profiles for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_categories_public_read on public.place_categories;
create policy canonical_categories_public_read on public.place_categories for select to anon, authenticated
using (is_active);
drop policy if exists canonical_categories_admin_all on public.place_categories;
create policy canonical_categories_admin_all on public.place_categories for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_tags_public_read on public.tags;
create policy canonical_tags_public_read on public.tags for select to anon, authenticated
using (is_active);
drop policy if exists canonical_tags_admin_all on public.tags;
create policy canonical_tags_admin_all on public.tags for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_tag_aliases_public_read on public.tag_aliases;
create policy canonical_tag_aliases_public_read on public.tag_aliases for select to anon, authenticated
using (exists(select 1 from public.tags t where t.id = tag_id and t.is_active));
drop policy if exists canonical_tag_aliases_admin_all on public.tag_aliases;
create policy canonical_tag_aliases_admin_all on public.tag_aliases for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_places_public_read on public.places;
create policy canonical_places_public_read on public.places for select to anon, authenticated
using (status = 'published');
drop policy if exists canonical_places_admin_all on public.places;
create policy canonical_places_admin_all on public.places for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_place_tags_public_read on public.place_tags;
create policy canonical_place_tags_public_read on public.place_tags for select to anon, authenticated
using (exists(select 1 from public.places p where p.id = place_id and p.status = 'published'));
drop policy if exists canonical_place_tags_admin_all on public.place_tags;
create policy canonical_place_tags_admin_all on public.place_tags for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_submissions_owner_select on public.place_submissions;
create policy canonical_submissions_owner_select on public.place_submissions for select to authenticated
using (submitted_by = (select auth.uid()) or private.current_user_is_admin());
drop policy if exists canonical_submissions_owner_insert on public.place_submissions;
create policy canonical_submissions_owner_insert on public.place_submissions for insert to authenticated
with check (submitted_by = (select auth.uid()) and status = 'draft');
drop policy if exists canonical_submissions_owner_update on public.place_submissions;
create policy canonical_submissions_owner_update on public.place_submissions for update to authenticated
using (submitted_by = (select auth.uid()) and status = 'draft')
with check (submitted_by = (select auth.uid()) and status in ('draft', 'pending'));
drop policy if exists canonical_submissions_owner_delete on public.place_submissions;
create policy canonical_submissions_owner_delete on public.place_submissions for delete to authenticated
using (submitted_by = (select auth.uid()) and status = 'draft');
drop policy if exists canonical_submissions_admin_all on public.place_submissions;
create policy canonical_submissions_admin_all on public.place_submissions for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_place_media_public_read on public.place_media;
create policy canonical_place_media_public_read on public.place_media for select to anon, authenticated
using (
  lifecycle_status = 'ready'
  and place_id is not null
  and exists(select 1 from public.places p where p.id = place_id and p.status = 'published')
);
drop policy if exists canonical_place_media_owner_select on public.place_media;
create policy canonical_place_media_owner_select on public.place_media for select to authenticated
using (uploaded_by = (select auth.uid()) or private.current_user_is_admin());
drop policy if exists canonical_place_media_owner_insert on public.place_media;
create policy canonical_place_media_owner_insert on public.place_media for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and submission_id is not null
  and exists(
    select 1 from public.place_submissions s
    where s.id = submission_id and s.submitted_by = (select auth.uid()) and s.status = 'draft'
  )
);
drop policy if exists canonical_place_media_owner_update on public.place_media;
create policy canonical_place_media_owner_update on public.place_media for update to authenticated
using (uploaded_by = (select auth.uid()) and submission_id is not null)
with check (uploaded_by = (select auth.uid()) and submission_id is not null);
drop policy if exists canonical_place_media_owner_delete on public.place_media;
create policy canonical_place_media_owner_delete on public.place_media for delete to authenticated
using (uploaded_by = (select auth.uid()) and submission_id is not null);
drop policy if exists canonical_place_media_admin_all on public.place_media;
create policy canonical_place_media_admin_all on public.place_media for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_reviews_public_read on public.reviews;
create policy canonical_reviews_public_read on public.reviews for select to anon, authenticated
using (
  status = 'published'
  and exists(select 1 from public.places p where p.id = place_id and p.status = 'published')
);
drop policy if exists canonical_reviews_owner_select on public.reviews;
create policy canonical_reviews_owner_select on public.reviews for select to authenticated
using (user_id = (select auth.uid()) or private.current_user_is_admin());
drop policy if exists canonical_reviews_owner_insert on public.reviews;
create policy canonical_reviews_owner_insert on public.reviews for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists(select 1 from public.places p where p.id = place_id and p.status = 'published')
);
drop policy if exists canonical_reviews_owner_update on public.reviews;
create policy canonical_reviews_owner_update on public.reviews for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists canonical_reviews_owner_delete on public.reviews;
create policy canonical_reviews_owner_delete on public.reviews for delete to authenticated
using (user_id = (select auth.uid()));
drop policy if exists canonical_reviews_admin_all on public.reviews;
create policy canonical_reviews_admin_all on public.reviews for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_review_media_public_read on public.review_media;
create policy canonical_review_media_public_read on public.review_media for select to anon, authenticated
using (exists(select 1 from public.reviews r where r.id = review_id and r.status = 'published'));
drop policy if exists canonical_review_media_owner_insert on public.review_media;
create policy canonical_review_media_owner_insert on public.review_media for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists(select 1 from public.reviews r where r.id = review_id and r.user_id = (select auth.uid()))
);
drop policy if exists canonical_review_media_owner_update on public.review_media;
create policy canonical_review_media_owner_update on public.review_media for update to authenticated
using (uploaded_by = (select auth.uid()))
with check (uploaded_by = (select auth.uid()));
drop policy if exists canonical_review_media_owner_delete on public.review_media;
create policy canonical_review_media_owner_delete on public.review_media for delete to authenticated
using (uploaded_by = (select auth.uid()));
drop policy if exists canonical_review_media_admin_all on public.review_media;
create policy canonical_review_media_admin_all on public.review_media for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists canonical_search_events_anon_insert on public.search_events;
create policy canonical_search_events_anon_insert on public.search_events for insert to anon
with check (user_id is null);
drop policy if exists canonical_search_events_member_insert on public.search_events;
create policy canonical_search_events_member_insert on public.search_events for insert to authenticated
with check (user_id is null or user_id = (select auth.uid()));
drop policy if exists canonical_search_events_admin_read on public.search_events;
create policy canonical_search_events_admin_read on public.search_events for select to authenticated
using (private.current_user_is_admin());

drop policy if exists canonical_admin_audit_admin_read on public.admin_audit_logs;
create policy canonical_admin_audit_admin_read on public.admin_audit_logs for select to authenticated
using (private.current_user_is_admin());

drop policy if exists canonical_submission_storage_select on storage.objects;
create policy canonical_submission_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'submission-media'
  and (owner_id = (select auth.uid())::text or private.current_user_is_admin())
);
drop policy if exists canonical_submission_storage_insert on storage.objects;
create policy canonical_submission_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists canonical_submission_storage_update on storage.objects;
create policy canonical_submission_storage_update on storage.objects for update to authenticated
using (bucket_id = 'submission-media' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'submission-media' and owner_id = (select auth.uid())::text);
drop policy if exists canonical_submission_storage_delete on storage.objects;
create policy canonical_submission_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'submission-media' and owner_id = (select auth.uid())::text);
drop policy if exists canonical_place_storage_admin_insert on storage.objects;
create policy canonical_place_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'place-media' and private.current_user_is_admin());
drop policy if exists canonical_place_storage_admin_update on storage.objects;
create policy canonical_place_storage_admin_update on storage.objects for update to authenticated
using (bucket_id = 'place-media' and private.current_user_is_admin())
with check (bucket_id = 'place-media' and private.current_user_is_admin());
drop policy if exists canonical_place_storage_admin_delete on storage.objects;
create policy canonical_place_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'place-media' and private.current_user_is_admin());

commit;
