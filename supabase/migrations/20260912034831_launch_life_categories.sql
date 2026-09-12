-- Applied to Macau-Student-Map after explicit approval on 2026-09-12. No place/favorite rows are changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Refuse conflicting IDs instead of overwriting an independently created taxonomy entry.
do $$
begin
  if exists (
    select 1 from public.tags
    where (slug = 'bar' and id <> '00000000-0000-0000-0000-000000000704'::uuid)
       or (slug = 'murder-mystery' and id <> '00000000-0000-0000-0000-000000000705'::uuid)
       or (id = '00000000-0000-0000-0000-000000000704'::uuid and (slug <> 'bar' or kind <> 'category' or not is_active))
       or (id = '00000000-0000-0000-0000-000000000705'::uuid and (slug <> 'murder-mystery' or kind <> 'category' or not is_active))
  ) then
    raise exception 'Launch taxonomy conflicts with existing tags; reconcile IDs before retrying';
  end if;
end $$;

insert into public.tags (id, slug, kind, label_zh_mo, label_en, sort_order)
values
  ('00000000-0000-0000-0000-000000000704', 'bar', 'category', '酒吧', 'Bar', 291),
  ('00000000-0000-0000-0000-000000000705', 'murder-mystery', 'category', '劇本殺', 'Murder mystery', 292)
on conflict (id) do nothing;

with aliases(tag_id, locale, terms) as (
  values
    ('00000000-0000-0000-0000-000000000704'::uuid, 'zh-CN', array['酒吧','清吧','酒馆']),
    ('00000000-0000-0000-0000-000000000704'::uuid, 'zh-MO', array['酒吧','清吧','酒館']),
    ('00000000-0000-0000-0000-000000000704'::uuid, 'en', array['bar','bars','pub']),
    ('00000000-0000-0000-0000-000000000705'::uuid, 'zh-CN', array['剧本杀','剧本杀店','剧本推理']),
    ('00000000-0000-0000-0000-000000000705'::uuid, 'zh-MO', array['劇本殺','劇本殺店']),
    ('00000000-0000-0000-0000-000000000705'::uuid, 'en', array['murder-mystery','murder mystery','scripted roleplay'])
)
insert into public.tag_aliases (tag_id, alias, normalized_alias, locale)
select tag_id, term, lower(btrim(term)), locale from aliases cross join lateral unnest(terms) as term
on conflict (tag_id, normalized_alias, locale) do nothing;

-- Keep every previously permitted value; add the canonical life categories used by admin forms.
alter table public.shops drop constraint if exists shops_category_check;
alter table public.shops add constraint shops_category_check
  check (category in ('food', 'drink', 'vibe', 'deal', 'all', 'shopping', 'entertainment', 'service'));

commit;
