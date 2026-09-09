create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text,
  body text,
  color text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create index if not exists notes_creative_idx on public.notes(creative_id);
create index if not exists notes_project_idx on public.notes(project_id);
drop policy if exists "notes_select_own" on public.notes;
drop policy if exists "notes_insert_own" on public.notes;
drop policy if exists "notes_update_own" on public.notes;
drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_select_own" on public.notes for select using (auth.uid() = creative_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = creative_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = creative_id);
