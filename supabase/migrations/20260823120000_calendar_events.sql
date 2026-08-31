create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  event_date date not null,
  all_day boolean not null default false,
  start_time time,
  notes text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_user_date_idx on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_manage_own on public.calendar_events;
create policy calendar_events_manage_own
  on public.calendar_events
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
