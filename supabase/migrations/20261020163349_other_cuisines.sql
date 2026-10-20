-- Extend the existing food taxonomy; keep all existing place and submission tags intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1 from public.tags
    where (id in ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000113')
      or slug in ('indian-cuisine', 'other-cuisine'))
      and not ((id = '00000000-0000-0000-0000-000000000112' and slug = 'indian-cuisine')
        or (id = '00000000-0000-0000-0000-000000000113' and slug = 'other-cuisine'))
  ) then
    raise exception 'Cuisine tag ID/slug collision';
  end if;
end $$;

insert into public.tags(id,slug,kind,label_zh_mo,label_en,sort_order,is_active) values
  ('00000000-0000-0000-0000-000000000112','indian-cuisine','cuisine','印度菜','Indian cuisine',112,true),
  ('00000000-0000-0000-0000-000000000113','other-cuisine','cuisine','其他菜系','Other cuisines',113,true)
on conflict (id) do update set kind=excluded.kind, label_zh_mo=excluded.label_zh_mo,
  label_en=excluded.label_en, sort_order=excluded.sort_order, is_active=excluded.is_active;

with aliases(tag_id,locale,terms) as (values
  ('00000000-0000-0000-0000-000000000112'::uuid,'zh-MO',array['印度菜','印度料理','印度餐','印餐']),
  ('00000000-0000-0000-0000-000000000112'::uuid,'en',array['Indian cuisine','Indian food']),
  ('00000000-0000-0000-0000-000000000113'::uuid,'zh-MO',array['其他菜系','其它菜系','其他料理']),
  ('00000000-0000-0000-0000-000000000113'::uuid,'en',array['Other cuisine','Other cuisines'])
)
insert into public.tag_aliases(tag_id,alias,normalized_alias,locale)
select tag_id,term,lower(btrim(term)),locale from aliases cross join lateral unnest(terms) term
on conflict(tag_id,normalized_alias,locale) do nothing;

-- Parent terms are search aliases only; stored child tags retain their exact meaning.
insert into public.tag_aliases(tag_id,alias,normalized_alias,locale)
select child.id,a.alias,a.normalized_alias,a.locale
from public.tags child cross join public.tag_aliases a join public.tags parent on parent.id=a.tag_id
where child.slug in ('indian-cuisine','southeast-asian-cuisine') and parent.slug='other-cuisine'
on conflict(tag_id,normalized_alias,locale) do nothing;

create or replace function private.assert_place_editor_input(p_input jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_tags uuid[];
  v_count integer;
  v_lng double precision := (p_input->>'longitude')::double precision;
  v_lat double precision := (p_input->>'latitude')::double precision;
  v_allowed text[];
begin
  if jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in
    ('name','nameEn','address','categorySlug','region','longitude','latitude','pricePerPerson','tagIds','searchKeywords','status')) then
    raise exception 'Unsupported editor fields' using errcode='23514';
  end if;
  if coalesce(length(btrim(p_input->>'name')),0) not between 1 and 120
     or coalesce(length(p_input->>'nameEn'),0)>120 or coalesce(length(p_input->>'address'),0)>500
     or coalesce(p_input->>'categorySlug','') not in ('food','shopping','entertainment','service')
     or coalesce(p_input->>'status','') not in ('draft','published','archived')
     or (p_input->>'region' is not null and p_input->>'region' not in ('macau-peninsula','taipa','coloane','hengqin','zhuhai','other')) then
    raise exception 'Invalid place details' using errcode='23514';
  end if;
  if (v_lng is null)<>(v_lat is null) or
     (p_input->>'status'='published' and v_lng is null) or
     (v_lng is not null and (v_lng not between 113 and 114.2 or v_lat not between 21.8 and 22.6)) or
     ((p_input->>'pricePerPerson')::numeric not between 0 and 100000) then
    raise exception 'Invalid coordinates or price' using errcode='23514';
  end if;
  if coalesce(jsonb_typeof(p_input->'tagIds'),'null')<>'array' or
     coalesce(jsonb_typeof(p_input->'searchKeywords'),'null')<>'array' then
    raise exception 'Tags and keywords must be arrays' using errcode='23514';
  end if;
  select array_agg(distinct value::uuid) into v_tags from jsonb_array_elements_text(p_input->'tagIds');
  if coalesce(cardinality(v_tags),0) not between 1 and 8 or jsonb_array_length(p_input->'tagIds')>8 or
     jsonb_array_length(p_input->'searchKeywords')>8 or exists(
       select 1 from jsonb_array_elements(p_input->'searchKeywords') value
       where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 40) then
    raise exception 'Invalid tag or keyword count' using errcode='23514';
  end if;
  perform t.id from public.tags t where t.id=any(v_tags) for share;
  select count(*) into v_count from public.tags where id=any(v_tags) and is_active;
  if v_count<>cardinality(v_tags) then raise exception 'Missing or inactive tags' using errcode='23514'; end if;
  v_allowed:=case p_input->>'categorySlug'
    when 'food' then array['chinese-cuisine','portuguese-cuisine','cha-chaan-teng','hot-pot','western-cuisine','japanese-cuisine','korean-cuisine','barbecue','snack','fast-food','southeast-asian-cuisine','indian-cuisine','other-cuisine','coffee','milk-tea','fruit-tea','bread','dessert','cake','burger','fried-chicken']
    when 'service' then array['printing','hair-salon','repair-service']
    when 'shopping' then array['clothing','electronics','supermarket']
    else array['karaoke','cinema','board-games','bar','murder-mystery'] end;
  if not exists(select 1 from public.tags where id=any(v_tags) and kind in ('category','cuisine','product')) or
     exists(select 1 from public.tags where id=any(v_tags) and kind in ('category','cuisine','product') and not(slug=any(v_allowed))) then
    raise exception 'Place category and tags conflict' using errcode='23514';
  end if;
end $$;
revoke all on function private.assert_place_editor_input(jsonb) from public,anon,authenticated;

-- Keep the SQL search RPC consistent with the public map filters.
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
  with requested_tags as (
    select t.id, t.kind from public.tags t
    where t.id = any(coalesce(p_tag_ids, '{}'::uuid[]))
    union
    select child.id, child.kind from public.tags child
    where child.is_active and child.slug in ('indian-cuisine', 'southeast-asian-cuisine')
      and exists (select 1 from public.tags parent where parent.slug = 'other-cuisine'
        and parent.id = any(coalesce(p_tag_ids, '{}'::uuid[])))
  ), input as (
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
          where t.id = any(array(select id from requested_tags))
        ) requested
        where not exists (
          select 1
          from public.place_tags selected_pt
          join public.tags selected_tag on selected_tag.id = selected_pt.tag_id
          where selected_pt.place_id = p.id
            and selected_tag.kind = requested.kind
            and selected_tag.id = any(array(select id from requested_tags))
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

commit;
