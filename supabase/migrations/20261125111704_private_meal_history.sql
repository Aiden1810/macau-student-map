create table public.meal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_name text not null check (char_length(btrim(restaurant_name)) between 1 and 120),
  cuisine text not null default '' check (char_length(cuisine) <= 80),
  eaten_on date not null check (isfinite(eaten_on)),
  feedback text check (feedback in ('liked', 'neutral', 'disliked')),
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

create index meal_history_user_date_idx
  on public.meal_history (user_id, eaten_on desc, created_at desc, id desc);

alter table public.meal_history enable row level security;
revoke all on public.meal_history from public, anon, authenticated;
grant select, delete on public.meal_history to authenticated;
grant insert (id, user_id, restaurant_name, cuisine, eaten_on, feedback, note) on public.meal_history to authenticated;
grant update (restaurant_name, cuisine, eaten_on, feedback, note) on public.meal_history to authenticated;

create policy "Owners manage their meals" on public.meal_history for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.meal_taste_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('restaurant', 'cuisine', 'flavor')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  sentiment text not null check (sentiment in ('like', 'avoid')),
  created_at timestamptz not null default now()
);

create unique index meal_taste_preferences_user_label_idx
  on public.meal_taste_preferences (user_id, kind, lower(btrim(label)));

alter table public.meal_taste_preferences enable row level security;
revoke all on public.meal_taste_preferences from public, anon, authenticated;
grant select, delete on public.meal_taste_preferences to authenticated;
grant insert (id, user_id, kind, label, sentiment) on public.meal_taste_preferences to authenticated;
grant update (kind, label, sentiment) on public.meal_taste_preferences to authenticated;

create policy "Owners manage their taste preferences" on public.meal_taste_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
