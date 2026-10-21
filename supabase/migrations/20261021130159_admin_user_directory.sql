begin;

-- Auth data stays in auth.users. Only these bounded, admin-checked reads expose
-- the fields needed by the management UI; clients receive no Auth table grants.
create or replace function private.admin_list_users(p_query text, p_page integer, p_page_size integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.current_user_is_admin(),false) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_page is null or p_page not between 1 and 1000000 or
     p_page_size is null or p_page_size not between 1 and 50 or length(v_query)>200 then
    raise exception 'Invalid directory query' using errcode='22023';
  end if;
  with registered as materialized (
    select u.id,u.email,u.created_at from auth.users u
    where u.deleted_at is null and not coalesce(u.is_anonymous,false)
  ), matched as materialized (
    select * from registered u where v_query='' or
      strpos(lower(coalesce(u.email,'')),v_query)>0 or strpos(u.id::text,v_query)>0
  ), page_items as (
    select u.id,u.email,u.created_at,coalesce(p.role,'member') as role
    from matched u left join public.profiles p on p.id=u.id
    order by u.created_at desc nulls last,u.id
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'total',(select count(*) from registered), 'matched',(select count(*) from matched),
    'page',p_page, 'pageSize',p_page_size,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'email',i.email,'createdAt',i.created_at,'role',i.role
    ) order by i.created_at desc nulls last,i.id) from page_items i),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_list_users(p_query text default '', p_page integer default 1, p_page_size integer default 25)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.admin_list_users(p_query,p_page,p_page_size);
$$;

create or replace function private.admin_account_emails(p_user_ids uuid[])
returns table(user_id uuid,email text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce(private.current_user_is_admin(),false) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_user_ids is null or cardinality(p_user_ids)>500 then
    raise exception 'Invalid account batch' using errcode='22023';
  end if;
  return query select u.id,u.email::text from auth.users u
    where u.id=any(p_user_ids) and u.deleted_at is null;
end $$;

create or replace function public.admin_account_emails(p_user_ids uuid[])
returns table(user_id uuid,email text) language sql stable security invoker set search_path='' as $$
  select * from private.admin_account_emails(p_user_ids);
$$;

revoke all on function private.admin_list_users(text,integer,integer),
  public.admin_list_users(text,integer,integer),
  private.admin_account_emails(uuid[]),public.admin_account_emails(uuid[])
  from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_list_users(text,integer,integer),
  public.admin_list_users(text,integer,integer),
  private.admin_account_emails(uuid[]),public.admin_account_emails(uuid[]) to authenticated;

commit;
