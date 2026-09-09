-- Support tickets: contact form submissions from the app and public site.
-- Rows are created by the submit-support-ticket edge function (service role).
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text not null,
  role text,
  category text,
  subject text,
  message text not null,
  status text not null default 'open',
  admin_notes text
);

alter table public.support_tickets enable row level security;

-- Admins can read and manage every ticket.
drop policy if exists "support_admin_all" on public.support_tickets;
create policy "support_admin_all" on public.support_tickets
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Signed-in users can read the tickets they raised.
drop policy if exists "support_read_own" on public.support_tickets;
create policy "support_read_own" on public.support_tickets
  for select
  using (user_id = auth.uid());

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
