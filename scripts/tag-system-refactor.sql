-- Macau Lens tag system refactor (idempotent / rerunnable)
-- Run in Supabase SQL editor.

-- =========================================================
-- 0) Column bootstrap
-- =========================================================
alter table public.shops
  add column if not exists features text[] not null default '{}',
  add column if not exists shop_type text,
  add column if not exists rating_label text default '暂无评分',
  add column if not exists review_count integer not null default 0;

alter table public.shops
  alter column category type text using lower(coalesce(category, 'food')),
  alter column category set default 'food';

-- =========================================================
-- 1) Normalize legacy category/rating label data
-- =========================================================
update public.shops
set category = case
  when category is null or btrim(category) = '' then 'food'

  -- already-valid new values
  when lower(category) in ('food', 'drink', 'vibe', 'deal', 'all') then lower(category)

  -- legacy chinese values
  when category in ('美食', '餐饮') then 'food'
  when category in ('饮品', '咖啡', '奶茶') then 'drink'
  when category in ('氛围', '环境') then 'vibe'
  when category in ('优惠', '折扣') then 'deal'

  -- historical values seen in this project
  when category in ('服务', '校园') then 'vibe'
  when category in ('购物') then 'deal'
  when category in ('其他') then 'food'

  -- safe fallback
  else 'food'
end;

update public.shops
set rating_label = case
  when rating_label = '值得一试' then '强烈推荐'
  when rating_label = '中规中矩' then '还行吧'
  when rating_label is null or btrim(rating_label) = '' then '暂无评分'
  else rating_label
end;

-- Align rating by explicit rating_label for rows without comments yet
update public.shops
set rating = case
  when rating_label = '封神之作' then 5.0
  when rating_label = '强烈推荐' then 4.0
  when rating_label = '还行吧' then 3.0
  when rating_label = '建议避雷' then coalesce(nullif(rating, 0), 1.5)
  else null
end
where coalesce(review_count, 0) = 0;

alter table public.shops
  alter column category set not null;

-- =========================================================
-- 2) Constraints (add after data normalization)
-- =========================================================
alter table public.shops drop constraint if exists shops_category_check;
alter table public.shops add constraint shops_category_check
  check (category in ('food', 'drink', 'vibe', 'deal', 'all'));

alter table public.shops drop constraint if exists shops_shop_type_check;
alter table public.shops add constraint shops_shop_type_check
  check (shop_type is null or shop_type in ('正餐', '快餐小吃', '饮品甜点', '服务'));

alter table public.shops drop constraint if exists shops_rating_label_check;
alter table public.shops add constraint shops_rating_label_check
  check (rating_label in ('封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分'));

-- =========================================================
-- 3) Recompute function from comments -> shops aggregate fields
-- =========================================================
create or replace function public.recompute_shop_rating(target_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_count integer;
  v_sum numeric;
  v_label text;
begin
  select
    avg(c.rating)::numeric,
    count(*)::integer,
    coalesce(sum(c.rating), 0)::numeric
  into v_avg, v_count, v_sum
  from public.comments c
  where c.shop_id = target_shop_id;

  v_label := case
    when coalesce(v_count, 0) = 0 then '暂无评分'
    when round(v_avg::numeric, 1) >= 5 then '封神之作'
    when round(v_avg::numeric, 1) >= 4 then '强烈推荐'
    when round(v_avg::numeric, 1) >= 3 then '还行吧'
    else '建议避雷'
  end;

  update public.shops s
  set
    rating = case when coalesce(v_count, 0) = 0 then null else round(v_avg::numeric, 1) end,
    review_count = coalesce(v_count, 0),
    rating_count = coalesce(v_count, 0),
    total_sum = v_sum,
    rating_label = v_label
  where s.id = target_shop_id;
end;
$$;

-- Optional: keep trigger in this file as well (safe to rerun)
create or replace function public.trg_comments_recompute_shop_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_shop_rating(new.shop_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.shop_id is distinct from new.shop_id then
      perform public.recompute_shop_rating(old.shop_id);
      perform public.recompute_shop_rating(new.shop_id);
    else
      perform public.recompute_shop_rating(new.shop_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.recompute_shop_rating(old.shop_id);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists comments_recompute_shop_rating on public.comments;

create trigger comments_recompute_shop_rating
after insert or update or delete on public.comments
for each row
execute function public.trg_comments_recompute_shop_rating();

-- =========================================================
-- 4) Full backfill from comments
-- =========================================================
update public.shops s
set
  rating = src.avg_rating,
  review_count = src.review_count,
  rating_count = src.review_count,
  total_sum = src.total_sum,
  rating_label = case
    when src.review_count = 0 then '暂无评分'
    when src.avg_rating >= 5 then '封神之作'
    when src.avg_rating >= 4 then '强烈推荐'
    when src.avg_rating >= 3 then '还行吧'
    else '建议避雷'
  end
from (
  select
    s2.id as shop_id,
    round(avg(c.rating)::numeric, 1) as avg_rating,
    count(c.id)::integer as review_count,
    coalesce(sum(c.rating), 0)::numeric as total_sum
  from public.shops s2
  left join public.comments c on c.shop_id = s2.id
  group by s2.id
) src
where s.id = src.shop_id;

-- =========================================================
-- 5) Validation queries (read-only)
-- =========================================================
-- Expect 0 rows:
-- select id, name, category from public.shops
-- where category not in ('food', 'drink', 'vibe', 'deal', 'all') or category is null or btrim(category) = '';
