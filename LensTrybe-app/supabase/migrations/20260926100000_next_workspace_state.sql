-- LensTrybe Next: the workspace's own settings (availability rules, templates, categories, defaults)
-- that have no table on the live site. One jsonb document per creative, owner-only.
create table if not exists public.workspace_state (
  creative_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspace_state enable row level security;
drop policy if exists workspace_state_owner on public.workspace_state;
create policy workspace_state_owner on public.workspace_state for all to authenticated
  using (creative_id = (select auth.uid())) with check (creative_id = (select auth.uid()));
revoke all on public.workspace_state from anon;
grant select, insert, update, delete on public.workspace_state to authenticated;

-- creative_busy_times also honours workspace_state.avail (days not worked, away ranges, weekly days off,
-- closed seasons). Applied as migration next_busy_times_workspace_rules; see the database for the body.
