-- Adds a separate inbox. Does not update places, shops, media or prices.
begin;

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('issue', 'correction', 'complaint', 'suggestion')),
  place text not null default '' check (char_length(place) <= 200),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  reply_to text not null default '' check (char_length(reply_to) <= 200),
  locale text not null default 'zh-CN' check (locale in ('zh-CN', 'zh-MO', 'en')),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  constraint user_feedback_handled_state check (
    (status = 'pending' and handled_at is null and handled_by is null)
    or (status = 'resolved' and handled_at is not null)
  )
);

create index user_feedback_status_created_idx on public.user_feedback(status, created_at desc, id);
create index user_feedback_user_idx on public.user_feedback(user_id);
create index user_feedback_handled_by_idx on public.user_feedback(handled_by) where handled_by is not null;

alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from public, anon, authenticated;
grant select on public.user_feedback to authenticated;
grant insert (id, user_id, category, place, message, reply_to, locale) on public.user_feedback to authenticated;
grant update (status, handled_at, handled_by) on public.user_feedback to authenticated;

create policy feedback_read_own_or_admin on public.user_feedback
for select to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

create policy feedback_submit_own on public.user_feedback
for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending' and handled_at is null and handled_by is null);

create policy feedback_admin_handle on public.user_feedback
for update to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

comment on table public.user_feedback is 'Private user feedback inbox. Public visitors have no access; administrators handle feedback.';
commit;
