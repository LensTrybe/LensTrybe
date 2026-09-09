-- Extend waitlist for the launch waitlist page
alter table public.waitlist add column if not exists name text;
alter table public.waitlist add column if not exists audience text not null default 'creative';
alter table public.waitlist add column if not exists creative_type text;
alter table public.waitlist add column if not exists referral_code text;
alter table public.waitlist add column if not exists referred_by text;
alter table public.waitlist add column if not exists source text;

-- Dedupe emails case-insensitively
create unique index if not exists waitlist_email_lower_idx on public.waitlist (lower(email));
create index if not exists waitlist_audience_created_idx on public.waitlist (audience, created_at);
create index if not exists waitlist_referral_code_idx on public.waitlist (referral_code);

-- Public live counter without exposing rows
create or replace function public.waitlist_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total', count(*),
    'creatives', count(*) filter (where audience = 'creative'),
    'clients', count(*) filter (where audience = 'client')
  )
  from public.waitlist;
$$;

grant execute on function public.waitlist_stats() to anon, authenticated;
