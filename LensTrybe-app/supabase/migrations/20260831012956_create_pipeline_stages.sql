-- Customizable pipeline stages, one set per creative.
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#8b8f9a',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pipeline_stages enable row level security;

drop policy if exists "creatives manage own pipeline stages" on public.pipeline_stages;
create policy "creatives manage own pipeline stages"
  on public.pipeline_stages
  for all
  using (auth.uid() = creative_id)
  with check (auth.uid() = creative_id);

create index if not exists pipeline_stages_creative_pos_idx
  on public.pipeline_stages (creative_id, position);

-- Projects point at a stage by id, so renaming/recolouring a stage never breaks the link.
alter table public.projects
  add column if not exists stage_id uuid references public.pipeline_stages(id) on delete set null;

create index if not exists projects_stage_id_idx on public.projects (stage_id);
