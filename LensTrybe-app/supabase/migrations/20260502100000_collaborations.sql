-- Creative collaboration hub: open posts and invites between creatives.

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles (id) on delete cascade,
  roles_needed text[] not null default '{}',
  work_type text not null check (work_type in ('on-location', 'remote', 'both')),
  arrangement text not null check (arrangement in ('one-off', 'ongoing')),
  location text,
  timeline text,
  budget_type text not null check (budget_type in ('paid', 'tfp')),
  budget_amount numeric,
  brief text not null,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaborations_posted_by_idx on public.collaborations (posted_by);
create index if not exists collaborations_status_idx on public.collaborations (status);

create table if not exists public.collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid references public.collaborations (id) on delete cascade,
  from_creative_id uuid not null references public.profiles (id) on delete cascade,
  to_creative_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collaboration_invites_distinct check (from_creative_id <> to_creative_id)
);

create index if not exists collaboration_invites_from_idx on public.collaboration_invites (from_creative_id);
create index if not exists collaboration_invites_to_idx on public.collaboration_invites (to_creative_id);
create index if not exists collaboration_invites_collab_idx on public.collaboration_invites (collaboration_id);

create unique index if not exists collaboration_invites_one_pending_interest
  on public.collaboration_invites (collaboration_id, from_creative_id)
  where status = 'pending' and collaboration_id is not null;

alter table public.collaborations enable row level security;
alter table public.collaboration_invites enable row level security;

-- Collaborations: anyone signed in can read open posts; poster manages own rows.
create policy collaborations_select_open
  on public.collaborations for select
  to authenticated
  using (status = 'open' or posted_by = auth.uid());

create policy collaborations_insert_own
  on public.collaborations for insert
  to authenticated
  with check (posted_by = auth.uid());

create policy collaborations_update_own
  on public.collaborations for update
  to authenticated
  using (posted_by = auth.uid())
  with check (posted_by = auth.uid());

-- Invites: visible to sender or recipient; insert as sender; update if party to invite.
create policy collaboration_invites_select_party
  on public.collaboration_invites for select
  to authenticated
  using (from_creative_id = auth.uid() or to_creative_id = auth.uid());

create policy collaboration_invites_insert_as_sender
  on public.collaboration_invites for insert
  to authenticated
  with check (from_creative_id = auth.uid());

create policy collaboration_invites_update_party
  on public.collaboration_invites for update
  to authenticated
  using (from_creative_id = auth.uid() or to_creative_id = auth.uid())
  with check (from_creative_id = auth.uid() or to_creative_id = auth.uid());
