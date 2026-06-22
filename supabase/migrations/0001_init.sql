-- InstaGRE initial schema: profiles, words, word_progress, streaks, test_history.
-- Run in the Supabase SQL editor (or via `supabase db push`). Idempotent-ish:
-- uses IF NOT EXISTS where possible, but intended as a one-time bootstrap.

-- Extensions ----------------------------------------------------------------
create extension if not exists moddatetime schema extensions;
-- gen_random_uuid() comes from pgcrypto, preinstalled on Supabase.

-- profiles ------------------------------------------------------------------
-- One row per auth user, created automatically by the handle_new_user trigger
-- from the metadata passed at signUp. `mobile` is the human identity (normalized
-- digits); `dob` doubles as the auth password (see app auth design).
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  full_name   text        not null,
  dob         date        not null,
  mobile      text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_mobile_key unique (mobile),
  constraint profiles_mobile_digits check (mobile ~ '^[0-9]{6,15}$')
);
create index if not exists profiles_mobile_idx on public.profiles (mobile);

-- words ---------------------------------------------------------------------
-- Global content, source of truth. Per-user flags do NOT live here.
create table if not exists public.words (
  id                   text        primary key,
  word                 text        not null,
  ipa                  text        not null default '',
  part_of_speech       text        not null default '',
  definition           text        not null,
  secondary_definition text,
  examples             text[]      not null default '{}',
  synonyms             text[]      not null default '{}',
  antonyms             text[]      not null default '{}',
  etymology            text        not null default '',
  audio_url            text,
  sort_order           int         not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists words_word_idx on public.words (word);

-- word_progress -------------------------------------------------------------
-- Per-user learning flags (the sync core). Composite PK enables upsert.
create table if not exists public.word_progress (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  word_id    text        not null references public.words (id) on delete cascade,
  mastered   boolean     not null default false,
  tough_nut  boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
create index if not exists word_progress_user_idx on public.word_progress (user_id);

-- streaks -------------------------------------------------------------------
create table if not exists public.streaks (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  count       int         not null default 0,
  last_active date,
  updated_at  timestamptz not null default now()
);

-- test_history --------------------------------------------------------------
-- Append-only. TestsView is disabled today; schema is ready for when it returns.
create table if not exists public.test_history (
  id         uuid         primary key default gen_random_uuid(),
  user_id    uuid         not null references auth.users (id) on delete cascade,
  score      int          not null,
  total      int          not null,
  percentage numeric(5,2) not null,
  mode       text         not null,
  taken_at   timestamptz  not null default now()
);
create index if not exists test_history_user_idx on public.test_history (user_id, taken_at desc);

-- handle_new_user trigger ---------------------------------------------------
-- Creates the profile row from raw_user_meta_data on signup. SECURITY DEFINER
-- so it bypasses the (deliberately absent) client INSERT policy on profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, mobile, dob)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'mobile',
    (new.raw_user_meta_data ->> 'dob')::date
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at moddatetime triggers ------------------------------------------
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function extensions.moddatetime (updated_at);

drop trigger if exists set_updated_at on public.words;
create trigger set_updated_at before update on public.words
  for each row execute function extensions.moddatetime (updated_at);

drop trigger if exists set_updated_at on public.word_progress;
create trigger set_updated_at before update on public.word_progress
  for each row execute function extensions.moddatetime (updated_at);

drop trigger if exists set_updated_at on public.streaks;
create trigger set_updated_at before update on public.streaks
  for each row execute function extensions.moddatetime (updated_at);

-- Row Level Security --------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.words         enable row level security;
alter table public.word_progress enable row level security;
alter table public.streaks       enable row level security;
alter table public.test_history  enable row level security;

-- profiles: self only (no client insert — trigger handles creation)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- words: any authenticated user can read; only service_role can write
drop policy if exists words_select_authed on public.words;
create policy words_select_authed on public.words
  for select to authenticated using (true);

-- word_progress: full CRUD on own rows
drop policy if exists wp_select_own on public.word_progress;
create policy wp_select_own on public.word_progress
  for select using (auth.uid() = user_id);
drop policy if exists wp_insert_own on public.word_progress;
create policy wp_insert_own on public.word_progress
  for insert with check (auth.uid() = user_id);
drop policy if exists wp_update_own on public.word_progress;
create policy wp_update_own on public.word_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists wp_delete_own on public.word_progress;
create policy wp_delete_own on public.word_progress
  for delete using (auth.uid() = user_id);

-- streaks: full CRUD on own row
drop policy if exists streaks_select_own on public.streaks;
create policy streaks_select_own on public.streaks
  for select using (auth.uid() = user_id);
drop policy if exists streaks_insert_own on public.streaks;
create policy streaks_insert_own on public.streaks
  for insert with check (auth.uid() = user_id);
drop policy if exists streaks_update_own on public.streaks;
create policy streaks_update_own on public.streaks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- test_history: read + append own rows (immutable)
drop policy if exists th_select_own on public.test_history;
create policy th_select_own on public.test_history
  for select using (auth.uid() = user_id);
drop policy if exists th_insert_own on public.test_history;
create policy th_insert_own on public.test_history
  for insert with check (auth.uid() = user_id);

-- PostgREST role grants (tables created in SQL don't inherit Supabase defaults)
grant all on table public.profiles to service_role;
grant select, update on table public.profiles to authenticated;

grant all on table public.words to service_role;
grant select on table public.words to authenticated;

grant all on table public.word_progress to service_role;
grant all on table public.word_progress to authenticated;

grant all on table public.streaks to service_role;
grant all on table public.streaks to authenticated;

grant all on table public.test_history to service_role;
grant select, insert on table public.test_history to authenticated;

-- Reminder: in Auth settings, DISABLE "Confirm email" so signUp returns a live
-- session immediately (synthetic emails have no inbox).
