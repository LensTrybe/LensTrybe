-- Founding invite codes: private table, only reachable via service-role Edge Functions or by admins.
create table if not exists public.founding_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  email text,                 -- optional: pre-assign a code to a specific creative
  full_name text,             -- optional: who the code was sent to (tracking)
  region text,                -- 'Sunshine Coast' | 'Brisbane' | 'Gold Coast'
  skill_type text,            -- for founding-allocation quotas
  status text not null default 'unused',   -- 'unused' | 'redeemed' | 'revoked'
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.founding_invites enable row level security;

-- No public read/write policy on purpose: anon and normal users cannot see codes.
-- Edge Functions use the service role (bypasses RLS) to validate and redeem.
-- Admins can manage codes from the dashboard.
create policy "admins_manage_founding_invites"
  on public.founding_invites for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create index if not exists founding_invites_code_idx on public.founding_invites (code);
create index if not exists founding_invites_status_idx on public.founding_invites (status);
