create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  location text,
  meeting_date date,
  start_time time,
  end_time time,
  client_name text,
  client_email text,
  status text not null default 'draft',
  response_token uuid not null default gen_random_uuid(),
  client_proposed_date date,
  client_proposed_time time,
  client_message text,
  responded_at timestamptz,
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings enable row level security;

drop policy if exists "creatives manage own meetings" on public.meetings;
create policy "creatives manage own meetings"
  on public.meetings for all
  using (auth.uid() = creative_id)
  with check (auth.uid() = creative_id);

create unique index if not exists meetings_response_token_idx on public.meetings (response_token);
create index if not exists meetings_creative_idx on public.meetings (creative_id);
create index if not exists meetings_project_idx on public.meetings (project_id);
