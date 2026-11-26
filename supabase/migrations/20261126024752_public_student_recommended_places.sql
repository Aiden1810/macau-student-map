begin;
set local lock_timeout = '3s';

-- Expose existing public place fields. Submission details remain under their existing RLS.
create function private.public_student_recommended_places()
returns table (place_id uuid, name text, address text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.address
  from public.place_submissions s
  cross join lateral (
    select a.metadata->>'place_id' as place_id
    from public.admin_audit_logs a
    where a.entity_type = 'place_submission' and a.entity_id = s.id::text
      and ((s.status = 'approved' and a.action in ('submission.publish_edited', 'submission.approve'))
        or (s.status = 'merged' and a.action = 'submission.merge'))
    order by a.created_at desc, a.id desc
    limit 1
  ) decision
  join public.places p on p.id::text = decision.place_id and p.status = 'published'
  where s.status in ('approved', 'merged')
  group by p.id
  order by max(s.reviewed_at) desc nulls last, p.id
  limit 500;
$$;
revoke all on function private.public_student_recommended_places() from public;
grant execute on function private.public_student_recommended_places() to anon, authenticated;

create function public.public_student_recommended_places()
returns table (place_id uuid, name text, address text)
language sql stable security invoker set search_path = ''
begin atomic
  select * from private.public_student_recommended_places();
end;
revoke all on function public.public_student_recommended_places() from public;
grant execute on function public.public_student_recommended_places() to anon, authenticated;

commit;
