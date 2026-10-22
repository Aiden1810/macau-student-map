begin;

create schema if not exists observability_private;
revoke all on schema observability_private from public,anon,authenticated;
create table observability_private.config (
  singleton boolean primary key default true check(singleton),
  token_hash text check(token_hash ~ '^[0-9a-f]{64}$'),
  enabled_at timestamptz,
  last_cleanup_at timestamptz
);
insert into observability_private.config(singleton) values(true);
create table observability_private.events (
  id uuid primary key,
  request_id uuid not null,
  occurred_at timestamptz not null,
  kind text not null check(kind in ('http','ai')),
  feature text not null check(feature in ('assistant.compare','assistant.chat','places.list','shops.list')),
  model text check(length(model) between 1 and 100),
  outcome text not null check(outcome in ('success','error','timeout','cancelled','limited','rejected','unconfigured')),
  duration_ms integer not null check(duration_ms between 0 and 300000),
  status integer check(status between 100 and 599),
  input_tokens bigint check(input_tokens between 0 and 1000000000),
  output_tokens bigint check(output_tokens between 0 and 1000000000),
  cache_read_tokens bigint check(cache_read_tokens between 0 and input_tokens),
  cost_low numeric(18,10) check(cost_low>=0),
  cost_high numeric(18,10) check(cost_high>=cost_low),
  price_version text check(length(price_version) between 1 and 64),
  check((kind='http' and model is null and status is not null and input_tokens is null and output_tokens is null and cost_low is null and cost_high is null and price_version is null)
    or (kind='ai' and model is not null and status is null)),
  check((cost_low is null and cost_high is null and price_version is null) or
    (cost_low is not null and cost_high is not null and price_version is not null and input_tokens is not null and output_tokens is not null))
);
create index usage_events_occurred_idx on observability_private.events(occurred_at);
alter table observability_private.config enable row level security;
alter table observability_private.events enable row level security;
revoke all on observability_private.config,observability_private.events from public,anon,authenticated;

-- A narrow server capability: it can only submit bounded metadata, never read
-- Auth/business tables. The raw token is provisioned outside source control.
create function observability_private.record_api_usage(p_token text,p_events jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_cleanup boolean;
begin
  if p_token is null or length(p_token)<>64 or not exists(
    select 1 from observability_private.config where singleton and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise exception 'Usage writer denied' using errcode='42501'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 20 or
     pg_column_size(p_events)>30000 then raise exception 'Invalid usage batch' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_events) e where jsonb_typeof(e)<>'object') or
     exists(select 1 from jsonb_array_elements(p_events) e, jsonb_object_keys(e) k where k not in
       ('id','request_id','occurred_at','kind','feature','model','outcome','duration_ms','status',
        'input_tokens','output_tokens','cache_read_tokens','cost_low','cost_high','price_version')) then
    raise exception 'Unsupported usage fields' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_events) e where (e->>'occurred_at')::timestamptz
      not between now()-interval '1 day' and now()+interval '5 minutes') then
    raise exception 'Invalid usage timestamp' using errcode='22023';
  end if;
  insert into observability_private.events select * from jsonb_to_recordset(p_events) as x(
    id uuid,request_id uuid,occurred_at timestamptz,kind text,feature text,model text,outcome text,duration_ms integer,status integer,
    input_tokens bigint,output_tokens bigint,cache_read_tokens bigint,cost_low numeric,cost_high numeric,price_version text
  ) on conflict(id) do nothing;
  get diagnostics v_count=row_count;
  update observability_private.config set last_cleanup_at=now() where singleton and
    (last_cleanup_at is null or last_cleanup_at<date_trunc('day',now())) returning true into v_cleanup;
  if v_cleanup then delete from observability_private.events where occurred_at<now()-interval '45 days'; end if;
  return v_count;
end $$;
create function public.record_api_usage(p_token text,p_events jsonb)
returns integer language sql security invoker set search_path='' as $$
  select observability_private.record_api_usage(p_token,p_events);
$$;
revoke all on function observability_private.record_api_usage(text,jsonb),public.record_api_usage(text,jsonb) from public,anon,authenticated;
grant usage on schema observability_private to anon,authenticated;
grant execute on function observability_private.record_api_usage(text,jsonb),public.record_api_usage(text,jsonb) to anon,authenticated;

create function private.dashboard_range_start(p_range text,p_now timestamptz)
returns timestamptz language plpgsql immutable security invoker set search_path='' as $$
begin
  if p_range is null or p_range not in ('24h','7d','30d') then raise exception 'Invalid range' using errcode='22023'; end if;
  return case when p_range='24h' then p_now-interval '24 hours'
    else (date_trunc('day',p_now at time zone 'Asia/Macau')-case when p_range='7d' then interval '6 days' else interval '29 days' end) at time zone 'Asia/Macau' end;
end $$;
revoke all on function private.dashboard_range_start(text,timestamptz) from public,anon,authenticated;

create function private.admin_registration_stats(p_range text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_start timestamptz; v_unit text; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.current_user_is_admin(),false) then raise exception 'Administrator required' using errcode='42501'; end if;
  v_start:=private.dashboard_range_start(p_range,v_now);
  v_unit:=case when p_range='24h' then 'hour' else 'day' end;
  with registered as materialized (select created_at from auth.users where deleted_at is null and not coalesce(is_anonymous,false)),
    counts as (select date_trunc(v_unit,created_at at time zone 'Asia/Macau') at time zone 'Asia/Macau' as bucket,count(*) as count
      from registered where created_at>=v_start and created_at<=v_now group by 1),
    buckets as (select b,coalesce(c.count,0) as count from generate_series(
      date_trunc(v_unit,v_start at time zone 'Asia/Macau') at time zone 'Asia/Macau',
      date_trunc(v_unit,v_now at time zone 'Asia/Macau') at time zone 'Asia/Macau',
      case when p_range='24h' then interval '1 hour' else interval '1 day' end) b left join counts c on c.bucket=b)
  select jsonb_build_object('range',p_range,'rangeStart',extract(epoch from v_start)*1000,'updatedAt',extract(epoch from v_now)*1000,
    'total',(select count(*) from registered),'newUsers',(select count(*) from registered where created_at>=v_start and created_at<=v_now),
    'timeline',(select jsonb_agg(jsonb_build_object('timestamp',extract(epoch from b)*1000,'label',
      to_char(b at time zone 'Asia/Macau',case when p_range='24h' then 'MM/DD HH24:MI' else 'MM/DD' end),'count',count) order by b) from buckets)) into v_result;
  return v_result;
end $$;
create function public.admin_registration_stats(p_range text default '7d')
returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_registration_stats(p_range); $$;

create function private.admin_usage_report(p_range text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_start timestamptz; v_unit text; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.current_user_is_admin(),false) then raise exception 'Administrator required' using errcode='42501'; end if;
  v_start:=private.dashboard_range_start(p_range,v_now);
  v_unit:=case when p_range='24h' then 'hour' else 'day' end;
  with base as materialized (select * from observability_private.events where occurred_at>=v_start and occurred_at<=v_now),
  metrics as (
    select kind,feature,model,grouping(feature) as is_summary,
      count(*) as calls,count(*) filter(where outcome='success') as succeeded,
      count(*) filter(where outcome='error') as failed,count(*) filter(where outcome='timeout') as timeouts,
      count(*) filter(where outcome='cancelled') as cancelled,count(*) filter(where outcome='limited') as limited,
      count(*) filter(where outcome='rejected') as rejected,count(*) filter(where outcome='unconfigured') as unconfigured,
      round(avg(duration_ms)) as "meanMs",percentile_disc(0.95) within group(order by duration_ms) as "p95Ms",
      coalesce(sum(input_tokens),0) as "inputTokens",coalesce(sum(output_tokens),0) as "outputTokens",
      count(*) filter(where kind='ai' and (input_tokens is null or output_tokens is null)) as "unknownUsage",
      count(*) filter(where cost_low is not null) as "pricedCalls",sum(cost_low) as "costLow",sum(cost_high) as "costHigh"
    from base group by grouping sets((kind),(kind,feature,model))
  ), counts as (select date_trunc(v_unit,occurred_at at time zone 'Asia/Macau') at time zone 'Asia/Macau' as bucket,
      count(*) filter(where kind='http') as http,count(*) filter(where kind='ai') as ai from base group by 1),
  buckets as (select b,coalesce(c.http,0) as http,coalesce(c.ai,0) as ai from generate_series(
    date_trunc(v_unit,v_start at time zone 'Asia/Macau') at time zone 'Asia/Macau',
    date_trunc(v_unit,v_now at time zone 'Asia/Macau') at time zone 'Asia/Macau',
    case when p_range='24h' then interval '1 hour' else interval '1 day' end) b left join counts c on c.bucket=b)
  select jsonb_build_object('range',p_range,'rangeStart',extract(epoch from v_start)*1000,'updatedAt',extract(epoch from v_now)*1000,
    'collection',(select jsonb_build_object('enabled',token_hash is not null,'startedAt',extract(epoch from enabled_at)*1000,
      'lastEventAt',(select extract(epoch from max(occurred_at))*1000 from observability_private.events)) from observability_private.config where singleton),
    'retentionDays',45,'currency','USD',
    'summary',coalesce((select jsonb_agg(to_jsonb(m)-'is_summary'-'feature'-'model' order by kind) from metrics m where is_summary=1),'[]'::jsonb),
    'breakdown',coalesce((select jsonb_agg(to_jsonb(m)-'is_summary' order by kind,feature,model) from metrics m where is_summary=0),'[]'::jsonb),
    'timeline',(select jsonb_agg(jsonb_build_object('timestamp',extract(epoch from b)*1000,'label',
      to_char(b at time zone 'Asia/Macau',case when p_range='24h' then 'MM/DD HH24:MI' else 'MM/DD' end),'http',http,'ai',ai) order by b) from buckets)) into v_result;
  return v_result;
end $$;
create function public.admin_usage_report(p_range text default '7d')
returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_usage_report(p_range); $$;
revoke all on function private.admin_registration_stats(text),public.admin_registration_stats(text),
  private.admin_usage_report(text),public.admin_usage_report(text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_registration_stats(text),public.admin_registration_stats(text),
  private.admin_usage_report(text),public.admin_usage_report(text) to authenticated;

commit;
