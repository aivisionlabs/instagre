-- Custom auth users (mobile + hashed DOB). Not tied to Supabase Auth.
create table if not exists public.app_users (
  id            uuid        primary key default gen_random_uuid(),
  mobile        text        not null,
  password_hash text        not null,
  full_name     text        not null,
  dob           date        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint app_users_mobile_key unique (mobile),
  constraint app_users_mobile_digits check (mobile ~ '^[0-9]{6,15}$')
);

create index if not exists app_users_mobile_idx on public.app_users (mobile);

drop trigger if exists set_updated_at on public.app_users;
create trigger set_updated_at before update on public.app_users
  for each row execute function extensions.moddatetime (updated_at);

alter table public.app_users enable row level security;

grant all on table public.app_users to service_role;

-- Point per-user tables at app_users instead of auth.users.
alter table public.word_progress drop constraint if exists word_progress_user_id_fkey;
alter table public.streaks drop constraint if exists streaks_user_id_fkey;
alter table public.test_history drop constraint if exists test_history_user_id_fkey;

alter table public.word_progress
  add constraint word_progress_user_id_fkey
  foreign key (user_id) references public.app_users (id) on delete cascade;

alter table public.streaks
  add constraint streaks_user_id_fkey
  foreign key (user_id) references public.app_users (id) on delete cascade;

alter table public.test_history
  add constraint test_history_user_id_fkey
  foreign key (user_id) references public.app_users (id) on delete cascade;
