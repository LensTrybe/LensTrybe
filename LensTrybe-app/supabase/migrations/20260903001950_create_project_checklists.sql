create table if not exists public.project_checklists (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Checklist',
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.project_checklists enable row level security;
create index if not exists proj_checklists_project_idx on public.project_checklists(project_id);
create index if not exists proj_checklists_creative_idx on public.project_checklists(creative_id);
drop policy if exists "proj_checklists_select_own" on public.project_checklists;
drop policy if exists "proj_checklists_insert_own" on public.project_checklists;
drop policy if exists "proj_checklists_update_own" on public.project_checklists;
drop policy if exists "proj_checklists_delete_own" on public.project_checklists;
create policy "proj_checklists_select_own" on public.project_checklists for select using (auth.uid() = creative_id);
create policy "proj_checklists_insert_own" on public.project_checklists for insert with check (auth.uid() = creative_id);
create policy "proj_checklists_update_own" on public.project_checklists for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "proj_checklists_delete_own" on public.project_checklists for delete using (auth.uid() = creative_id);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  checklist_id uuid not null references public.project_checklists(id) on delete cascade,
  text text not null default '',
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.checklist_items enable row level security;
create index if not exists checklist_items_list_idx on public.checklist_items(checklist_id);
create index if not exists checklist_items_creative_idx on public.checklist_items(creative_id);
drop policy if exists "checklist_items_select_own" on public.checklist_items;
drop policy if exists "checklist_items_insert_own" on public.checklist_items;
drop policy if exists "checklist_items_update_own" on public.checklist_items;
drop policy if exists "checklist_items_delete_own" on public.checklist_items;
create policy "checklist_items_select_own" on public.checklist_items for select using (auth.uid() = creative_id);
create policy "checklist_items_insert_own" on public.checklist_items for insert with check (auth.uid() = creative_id);
create policy "checklist_items_update_own" on public.checklist_items for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "checklist_items_delete_own" on public.checklist_items for delete using (auth.uid() = creative_id);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Template',
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;
create index if not exists checklist_templates_creative_idx on public.checklist_templates(creative_id);
drop policy if exists "checklist_templates_select_own" on public.checklist_templates;
drop policy if exists "checklist_templates_insert_own" on public.checklist_templates;
drop policy if exists "checklist_templates_update_own" on public.checklist_templates;
drop policy if exists "checklist_templates_delete_own" on public.checklist_templates;
create policy "checklist_templates_select_own" on public.checklist_templates for select using (auth.uid() = creative_id);
create policy "checklist_templates_insert_own" on public.checklist_templates for insert with check (auth.uid() = creative_id);
create policy "checklist_templates_update_own" on public.checklist_templates for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "checklist_templates_delete_own" on public.checklist_templates for delete using (auth.uid() = creative_id);
