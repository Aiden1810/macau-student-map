-- Local development fixtures only. Never push this seed to production.

insert into auth.users (id, email, raw_user_meta_data)
values (
  '90000000-0000-0000-0000-000000000001',
  'local-reviewer@example.com',
  '{}'::jsonb
)
on conflict (id) do nothing;
insert into public.profiles (id, role)
values ('90000000-0000-0000-0000-000000000001', 'member')
on conflict (id) do nothing;

insert into public.places (
  id,
  name,
  name_en,
  address,
  category_slug,
  region,
  longitude,
  latitude,
  price_per_person,
  status,
  published_at
) values
  (
    '80000000-0000-0000-0000-000000000001',
    '校園漢堡研究所',
    'Campus Burger Lab',
    '澳門氹仔大學大馬路',
    'food',
    'taipa',
    113.5567,
    22.1634,
    58,
    'published',
    now()
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '學生服飾倉',
    'Student Wardrobe',
    '澳門高士德大馬路',
    'shopping',
    'macau-peninsula',
    113.5452,
    22.2031,
    null,
    'published',
    now()
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    '週末唱 K 房',
    'Weekend Karaoke',
    '澳門新口岸',
    'entertainment',
    'macau-peninsula',
    113.5538,
    22.1908,
    120,
    'published',
    now()
  ),
  (
    '80000000-0000-0000-0000-000000000004',
    '氹仔手機維修站',
    'Taipa Phone Repair',
    '澳門氹仔地堡街',
    'service',
    'taipa',
    113.5581,
    22.1539,
    null,
    'published',
    now()
  )
on conflict (id) do nothing;

insert into public.place_tags (place_id, tag_id) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000501'),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000502'),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000801'),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000601'),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000701')
on conflict do nothing;

insert into public.reviews (id, place_id, user_id, rating, content, status)
values (
  '70000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  5,
  '本地開發資料：只有一條五星評價，因此不應直接成為高置信榜首。',
  'published'
)
on conflict (id) do nothing;
