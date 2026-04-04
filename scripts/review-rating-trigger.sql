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
begin
  select
    avg(c.rating)::numeric,
    count(*)::integer
  into v_avg, v_count
  from public.comments c
  where c.shop_id = target_shop_id;

  update public.shops s
  set
    rating = case when coalesce(v_count, 0) = 0 then 0 else round(v_avg::numeric, 1) end,
    review_count = coalesce(v_count, 0),
    rating_count = coalesce(v_count, 0),
    total_sum = (
      select coalesce(sum(c2.rating), 0)::numeric
      from public.comments c2
      where c2.shop_id = target_shop_id
    )
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
  rating = coalesce(src.avg_rating, 0),
  review_count = coalesce(src.review_count, 0),
  rating_count = coalesce(src.review_count, 0),
  total_sum = coalesce(src.total_sum, 0)
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

-- Ensure shops with no comments are reset to zero.
update public.shops s
set
  rating = 0,
  review_count = 0,
  rating_count = 0,
  total_sum = 0
where not exists (
  select 1 from public.comments c where c.shop_id = s.id
);
