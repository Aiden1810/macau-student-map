-- Run after the canonical migration/backfill. Every query should return zero rows,
-- except the final summary block which reports counts for manual comparison.

-- Published places must have a publication timestamp.
select id, name, status, published_at
from public.places
where status = 'published' and published_at is null;

-- Coordinates must be both present or both absent.
select id, name, longitude, latitude
from public.places
where (longitude is null) <> (latitude is null);

-- Join tables must not contain orphan references (FKs also enforce this).
select pt.*
from public.place_tags pt
left join public.places p on p.id = pt.place_id
left join public.tags t on t.id = pt.tag_id
where p.id is null or t.id is null;

-- Stored aggregates must match published reviews.
with actual as (
  select
    p.id,
    count(r.id)::integer as actual_count,
    avg(r.rating)::numeric(3,2) as actual_average
  from public.places p
  left join public.reviews r on r.place_id = p.id and r.status = 'published'
  group by p.id
)
select
  p.id,
  p.name,
  p.review_count,
  actual.actual_count,
  p.rating_average,
  actual.actual_average
from public.places p
join actual on actual.id = p.id
where p.review_count <> actual.actual_count
   or p.rating_average is distinct from actual.actual_average;

-- Media rows must point to exactly one parent and to an allowed bucket.
select id, place_id, submission_id, bucket_id, storage_path, lifecycle_status
from public.place_media
where ((place_id is null) = (submission_id is null))
   or bucket_id not in ('submission-media', 'place-media')
   or btrim(storage_path) = '';

-- Legacy backfill count comparison. Difference is expected only for invalid legacy rows.
select
  case when to_regclass('public.shops') is null then null
       else (select count(*) from public.shops)
  end as legacy_shop_count,
  count(*) filter (where legacy_shop_id is not null) as canonical_backfill_count,
  count(*) as canonical_place_count
from public.places;
