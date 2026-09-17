-- Inbound applications for a founding place.
--
-- Cold outreach means researching someone, finding an address and hoping. An application
-- is a creative who has read the offer and put their hand up, which is better signal and,
-- under the Spam Act, express consent rather than the inferred consent the cold invites
-- rely on.
--
-- Deliberately not the waitlist table. The waitlist is "tell me when you launch" and is a
-- marketing list. This is a queue with a lifecycle: applied, then invited or dismissed.

create table if not exists public.founding_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  creative_type text,
  region text,
  portfolio_url text,
  -- new, invited or dismissed. Nothing is deleted, so the queue stays auditable.
  status text not null default 'new',
  invite_id uuid references public.founding_invites(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint founding_applications_status_check
    check (status in ('new', 'invited', 'dismissed'))
);

-- One application per address. A second submission updates the first rather than filling
-- the queue with duplicates, which is what an impatient applicant will do.
create unique index if not exists founding_applications_email_key
  on public.founding_applications (lower(email));

create index if not exists founding_applications_status_created_idx
  on public.founding_applications (status, created_at desc);

-- No policies, so no anon or authenticated access at all. The submit function and the
-- admin panel both reach it with the service role, which bypasses RLS. A public table
-- holding names, emails and portfolio links should not be readable by the public.
alter table public.founding_applications enable row level security;

comment on table public.founding_applications is
  'Inbound applications for a founding place, from the form on /founding. Service role only. Lifecycle: new, then invited (invite_id set) or dismissed.';
