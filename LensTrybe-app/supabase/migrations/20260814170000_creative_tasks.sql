-- Per-creative to-do items: daily/weekly checklists + a kanban board.
create table if not exists public.creative_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          text not null default 'daily',   -- daily | weekly | board
  title         text not null,
  done          boolean not null default false,
  board_status  text,                             -- todo | in_progress | done (when kind='board')
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists creative_tasks_user_kind_idx on public.creative_tasks (user_id, kind);

alter table public.creative_tasks enable row level security;

drop policy if exists creative_tasks_manage_own on public.creative_tasks;
create policy creative_tasks_manage_own
  on public.creative_tasks
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
