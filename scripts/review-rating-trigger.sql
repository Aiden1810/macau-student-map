-- Keep shops.rating and shops.review_count in sync with comments table.
-- Safe to run multiple times.

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

-- One-time backfill for historical data.
update public.shops s
set
  rating = src.avg_rating,
  review_count = coalesce(src.review_count, 0),
  rating_count = coalesce(src.review_count, 0),
  total_sum = coalesce(src.total_sum, 0),
  rating_label = case
    when src.avg_rating >= 5 then '封神之作'
    when src.avg_rating >= 4 then '强烈推荐'
    when src.avg_rating >= 3 then '还行吧'
    else '建议避雷'
  end
from (
  select
    c.shop_id,
    round(avg(c.rating)::numeric, 1) as avg_rating,
    count(*)::integer as review_count,
    coalesce(sum(c.rating), 0)::numeric as total_sum
  from public.comments c
  group by c.shop_id
) src
where s.id = src.shop_id;

-- Ensure shops with no comments have no numeric score.
update public.shops s
set
  rating = null,
  review_count = 0,
  rating_count = 0,
  total_sum = 0,
  rating_label = '暂无评分'
where not exists (
  select 1 from public.comments c where c.shop_id = s.id
);
