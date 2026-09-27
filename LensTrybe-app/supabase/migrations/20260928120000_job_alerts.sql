-- New-job alerts for creatives (client-first launch, 28 Sep). When a job is posted, creatives who do
-- that kind of work and are in that state (or haven't set one) get an email and a bell notification.
-- The job-alert function sends them; this file holds the opt-out and the recipient list.

create table if not exists public.job_alert_optouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.job_alert_optouts enable row level security;
drop policy if exists "Own job alert choice" on public.job_alert_optouts;
create policy "Own job alert choice" on public.job_alert_optouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.job_alert_optouts from anon, authenticated;
grant select, insert, delete on public.job_alert_optouts to authenticated;

-- Who hears about a job. Service role only (the job-alert function). A job titled TEST… only reaches
-- the test accounts, so testing never emails real creatives.
create or replace function public.job_alert_recipients(p_job uuid)
returns table (id uuid, email text, name text)
language sql stable security definer set search_path = public as $$
  with j as (
    select jl.posted_by, public.job_state_of(jl.location) as st, coalesce(jl.creative_types, '{}') as ct,
           upper(btrim(jl.title)) like 'TEST%' as is_test
    from public.job_listings jl where jl.id = p_job and jl.status = 'active'
  )
  select p.id, coalesce(nullif(btrim(p.business_email), ''), u.email)::text, coalesce(nullif(btrim(p.business_name), ''), '')::text
  from j, public.profiles p join auth.users u on u.id = p.id
  where p.id is distinct from j.posted_by
    and not coalesce(p.is_admin, false)
    and not coalesce(p.pending_deletion, false)
    and coalesce(p.account_type, 'creative') <> 'client'
    and not exists (select 1 from public.job_alert_optouts o where o.user_id = p.id)
    and (j.st is null or coalesce(btrim(p.state), '') = '' or upper(btrim(p.state)) = j.st)
    and (cardinality(j.ct) = 0 or coalesce(cardinality(p.skill_types), 0) = 0 or p.skill_types && j.ct)
    and (not j.is_test or u.email in ('test-creative@lenstrybe.com', 'test-creative2@lenstrybe.com'))
$$;
revoke all on function public.job_alert_recipients(uuid) from public, anon, authenticated;
grant execute on function public.job_alert_recipients(uuid) to service_role;
