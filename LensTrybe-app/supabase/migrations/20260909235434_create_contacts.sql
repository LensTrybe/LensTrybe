-- Standalone address book for creatives (independent of crm_contacts).
-- The CRM can pull from this list so people don't get retyped.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  company text,
  notes text,
  instagram text,
  website text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

drop policy if exists "contacts_owner_all" on public.contacts;
create policy "contacts_owner_all" on public.contacts
  for all
  using (creative_id = auth.uid())
  with check (creative_id = auth.uid());

create index if not exists contacts_creative_name_idx on public.contacts (creative_id, name);
