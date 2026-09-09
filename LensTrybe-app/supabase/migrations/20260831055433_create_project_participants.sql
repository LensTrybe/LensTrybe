-- Additional people on a project (beyond the primary client), each with their own contact details.
create table if not exists public.project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creative_id uuid not null references public.profiles(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text,
  created_at timestamptz not null default now()
);

alter table public.project_participants enable row level security;

drop policy if exists "creatives manage own project participants" on public.project_participants;
create policy "creatives manage own project participants"
  on public.project_participants
  for all
  using (auth.uid() = creative_id)
  with check (auth.uid() = creative_id);

create index if not exists project_participants_project_idx on public.project_participants (project_id);
