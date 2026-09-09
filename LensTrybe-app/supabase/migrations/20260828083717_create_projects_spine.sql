-- PROJECTS: the spine that ties the dashboard together
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  title text not null,
  project_type text,
  stage text not null default 'new_inquiry',
  event_date date,
  lead_source text,
  value numeric,
  cover_image_url text,
  tags text[] default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects for select using (auth.uid() = creative_id);
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = creative_id);
create policy "projects_update_own" on public.projects for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = creative_id);

create index if not exists projects_creative_id_idx on public.projects (creative_id);
create index if not exists projects_stage_idx on public.projects (stage);

-- Link existing records to a project (all nullable, non-breaking)
alter table public.invoices        add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.quotes          add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.contracts       add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.deliveries      add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.message_threads add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.creative_tasks  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.calendar_events add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.bookings        add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists invoices_project_id_idx        on public.invoices (project_id);
create index if not exists quotes_project_id_idx          on public.quotes (project_id);
create index if not exists contracts_project_id_idx       on public.contracts (project_id);
create index if not exists deliveries_project_id_idx      on public.deliveries (project_id);
create index if not exists message_threads_project_id_idx on public.message_threads (project_id);
create index if not exists creative_tasks_project_id_idx  on public.creative_tasks (project_id);
create index if not exists calendar_events_project_id_idx on public.calendar_events (project_id);
create index if not exists bookings_project_id_idx        on public.bookings (project_id);
