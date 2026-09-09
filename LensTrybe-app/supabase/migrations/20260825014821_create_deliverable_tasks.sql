create table if not exists public.deliverable_tasks (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  client_name text,
  title text not null,
  due_date date,
  status text not null default 'editing',
  notes text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists deliverable_tasks_creative_idx on public.deliverable_tasks (creative_id, status, due_date);

alter table public.deliverable_tasks enable row level security;

drop policy if exists "deliverable_tasks_select_own" on public.deliverable_tasks;
create policy "deliverable_tasks_select_own" on public.deliverable_tasks
  for select using (auth.uid() = creative_id);

drop policy if exists "deliverable_tasks_insert_own" on public.deliverable_tasks;
create policy "deliverable_tasks_insert_own" on public.deliverable_tasks
  for insert with check (auth.uid() = creative_id);

drop policy if exists "deliverable_tasks_update_own" on public.deliverable_tasks;
create policy "deliverable_tasks_update_own" on public.deliverable_tasks
  for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);

drop policy if exists "deliverable_tasks_delete_own" on public.deliverable_tasks;
create policy "deliverable_tasks_delete_own" on public.deliverable_tasks
  for delete using (auth.uid() = creative_id);
