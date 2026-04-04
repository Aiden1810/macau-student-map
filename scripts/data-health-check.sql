-- data-health-check.sql
-- 目的：巡检标签系统与评分聚合一致性，可重复执行

-- 1) 店铺总量与状态分布
select
  count(*) as total_shops,
  count(*) filter (where status = 'pending' or status is null) as pending_shops,
  count(*) filter (where status = 'verified') as verified_shops,
  count(*) filter (where status = 'rejected') as rejected_shops
from shops;

-- 2) 核心筛选字段缺失检查
select
  count(*) filter (where category is null) as missing_category,
  count(*) filter (where shop_type is null) as missing_shop_type,
  count(*) filter (where rating_label is null) as missing_rating_label
from shops;

-- 3) category 非法值检查（新标签体系）
select id, name, category
from shops
where category is not null
  and category not in ('food', 'drink', 'vibe', 'deal')
order by id desc
limit 100;

-- 4) rating_label 非法值检查
select id, name, rating_label
from shops
where rating_label is not null
  and rating_label not in ('封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分')
order by id desc
limit 100;

-- 5) shop_type 非法值检查
select id, name, shop_type
from shops
where shop_type is not null
  and shop_type not in ('正餐', '快餐小吃', '饮品甜点', '服务')
order by id desc
limit 100;

-- 6) features 非法值检查（数组中任一值超出白名单）
select id, name, features
from shops
where features is not null
  and exists (
    select 1
    from unnest(features) as f
    where f not in ('有折扣', '学生价', '深夜营业', '适合拍照', '外卖可达')
  )
order by id desc
limit 100;

-- 7) 评论聚合一致性检查（shops.review_count vs comments数量）
with comment_counts as (
  select shop_id, count(*)::int as comment_count
  from comments
  group by shop_id
)
select
  s.id,
  s.name,
  coalesce(s.review_count, 0) as shop_review_count,
  coalesce(c.comment_count, 0) as comments_count
from shops s
left join comment_counts c on c.shop_id = s.id
where coalesce(s.review_count, 0) <> coalesce(c.comment_count, 0)
order by s.id desc
limit 100;

-- 8) 评论聚合一致性检查（shops.total_sum vs comments评分和）
with comment_sums as (
  select shop_id, coalesce(sum(rating), 0)::numeric as rating_sum
  from comments
  group by shop_id
)
select
  s.id,
  s.name,
  coalesce(s.total_sum, 0)::numeric as shop_total_sum,
  coalesce(cs.rating_sum, 0)::numeric as comments_rating_sum
from shops s
left join comment_sums cs on cs.shop_id = s.id
where coalesce(s.total_sum, 0)::numeric <> coalesce(cs.rating_sum, 0)::numeric
order by s.id desc
limit 100;

-- 9) 最近24小时新增监控
select
  count(*) filter (where created_at >= now() - interval '24 hours') as new_shops_24h,
  (select count(*) from comments where created_at >= now() - interval '24 hours') as new_comments_24h
from shops;
