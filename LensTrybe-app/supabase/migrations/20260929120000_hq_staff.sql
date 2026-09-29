-- LensTrybe HQ (hq.lenstrybe.com), item 19. The staff intranet.
--
-- Staff accounts are kept apart from creative and client accounts: a staff login can never
-- have a creative profile or a client account, and a creative or client can never be staff.
-- Nothing here is readable or writable over the REST API: every table has RLS on with no
-- policy, and every helper is callable by the service role only. The hq-api Edge Function
-- is the one way in, and it checks the caller is active staff, signed in with two-factor,
-- inside the idle and absolute session limits, before it does anything, and logs it.

create table if not exists public.hq_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('owner', 'admin', 'support')),
  active boolean not null default true,
  invited_by uuid references public.hq_staff(user_id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
-- One owner, ever.
create unique index if not exists hq_staff_one_owner on public.hq_staff ((true)) where role = 'owner';

create table if not exists public.hq_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null check (role in ('owner', 'admin', 'support')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.hq_staff(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hq_invites_email on public.hq_invites (lower(email));

create table if not exists public.hq_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  staff_id uuid,
  staff_email text,
  action text not null,
  target text,
  detail jsonb,
  ip text
);
create index if not exists hq_audit_at on public.hq_audit (at desc);

alter table public.hq_staff enable row level security;
alter table public.hq_invites enable row level security;
alter table public.hq_audit enable row level security;
revoke all on public.hq_staff, public.hq_invites, public.hq_audit from anon, authenticated;

-- The owner (Michael) cannot be removed, demoted or switched off, by anyone, through anything.
create or replace function public.hq_protect_owner() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then raise exception 'The HQ owner cannot be removed.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.role = 'owner' and (new.role <> 'owner' or new.active is not true or new.user_id <> old.user_id) then
    raise exception 'The HQ owner cannot be changed or switched off.' using errcode = '42501';
  end if;
  if old.role <> 'owner' and new.role = 'owner' then
    raise exception 'There is only one HQ owner.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists hq_protect_owner on public.hq_staff;
create trigger hq_protect_owner before update or delete on public.hq_staff
  for each row execute function public.hq_protect_owner();

-- The audit log only ever grows.
create or replace function public.hq_audit_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'The HQ activity log cannot be changed.' using errcode = '42501';
end $$;
drop trigger if exists hq_audit_append_only on public.hq_audit;
create trigger hq_audit_append_only before update or delete on public.hq_audit
  for each row execute function public.hq_audit_append_only();

-- Keep staff apart from creatives and clients.
create or replace function public.hq_keep_apart() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.hq_staff where user_id = new.id) then
    raise exception 'This is a LensTrybe HQ staff login. It cannot be used as a creative or client account.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists hq_keep_apart on public.profiles;
create trigger hq_keep_apart before insert on public.profiles for each row execute function public.hq_keep_apart();
drop trigger if exists hq_keep_apart on public.client_accounts;
create trigger hq_keep_apart before insert on public.client_accounts for each row execute function public.hq_keep_apart();

create or replace function public.hq_staff_is_apart() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id) or exists (select 1 from public.client_accounts where id = new.user_id) then
    raise exception 'A creative or client account cannot be made staff. Staff get their own login.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists hq_staff_is_apart on public.hq_staff;
create trigger hq_staff_is_apart before insert on public.hq_staff for each row execute function public.hq_staff_is_apart();

-- ---------------------------------------------------------------------------------------
-- Read helpers for hq-api. Service role only.
-- ---------------------------------------------------------------------------------------

-- Headline numbers for the Overview.
create or replace function public.hq_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (
    select au.id, au.created_at, au.last_sign_in_at,
      p.id is not null as creative, c.id is not null as client,
      lower(coalesce(p.subscription_tier, 'basic')) as tier, coalesce(p.founding_member, false) as founding,
      coalesce(p.is_listed, false) as listed
    from auth.users au
    left join public.profiles p on p.id = au.id
    left join public.client_accounts c on c.id = au.id
    where not exists (select 1 from public.hq_staff s where s.user_id = au.id)
  )
  select jsonb_build_object(
    'creatives', (select count(*) from u where creative),
    'clients', (select count(*) from u where client),
    'unfinished', (select count(*) from u where not creative and not client),
    'listed', (select count(*) from u where creative and listed),
    'by_tier', (select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb) from (select tier, count(*) n from u where creative group by tier) x),
    'signups_7', (select count(*) from u where created_at > now() - interval '7 days'),
    'signups_30', (select count(*) from u where created_at > now() - interval '30 days'),
    'active_7', (select count(*) from u where last_sign_in_at > now() - interval '7 days'),
    'active_30', (select count(*) from u where last_sign_in_at > now() - interval '30 days'),
    'signups_by_day', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'creatives', cr, 'clients', cl) order by d), '[]'::jsonb) from (
        select gs::date d,
          (select count(*) from u where creative and (created_at at time zone 'Australia/Brisbane')::date = gs::date) cr,
          (select count(*) from u where client and (created_at at time zone 'Australia/Brisbane')::date = gs::date) cl
        from generate_series((now() at time zone 'Australia/Brisbane')::date - 29, (now() at time zone 'Australia/Brisbane')::date, interval '1 day') gs) z),
    'subs', (select jsonb_build_object(
        'paying', count(*) filter (where status in ('active', 'past_due')),
        'trialing', count(*) filter (where status = 'trialing'),
        'past_due', count(*) filter (where status = 'past_due'),
        'cancelled', count(*) filter (where status in ('cancelled', 'canceled')),
        'mrr_minor', coalesce(round(sum(case when status in ('active', 'past_due') then case when billing = 'annual' then amount_minor / 12.0 else amount_minor end else 0 end)), 0),
        'trial_mrr_minor', coalesce(round(sum(case when status = 'trialing' then case when billing = 'annual' then amount_minor / 12.0 else amount_minor end else 0 end)), 0),
        'next_charge', (select min(next_charge_date) from public.subscriptions where status in ('active', 'trialing', 'past_due'))
      ) from public.subscriptions),
    'founding', jsonb_build_object('used', public.founding_places_used(), 'cap', public.founding_cap(),
        'redeemed', (select count(*) from public.profiles where founding_member),
        'applications_new', (select count(*) from public.founding_applications where status = 'new')),
    'jobs', jsonb_build_object(
        'open', (select count(*) from public.job_listings where status = 'active'),
        'posted_7', (select count(*) from public.job_listings where created_at > now() - interval '7 days'),
        'no_reply', (select count(*) from public.job_listings j where status = 'active' and not exists (select 1 from public.job_applications a where a.job_id = j.id)),
        'no_reply_24h', (select count(*) from public.job_listings j where status = 'active' and created_at < now() - interval '24 hours' and not exists (select 1 from public.job_applications a where a.job_id = j.id)),
        'replies_7', (select count(*) from public.job_applications where created_at > now() - interval '7 days')),
    'support_open', (select count(*) from public.support_tickets where coalesce(status, 'open') not in ('closed', 'resolved')),
    'reviews_flagged', (select count(*) from public.reviews where flagged and flag_status = 'pending'),
    'waitlist', (select count(*) from public.waitlist),
    'edit_readers', (select count(*) from public.email_subscribers where status = 'subscribed' and edit_opt_in_at is not null),
    'pending_deletion', (select count(*) from public.account_deletions where status = 'scheduled')
  )
$$;

-- Everyone, for the Users page. Staff logins are left out.
create or replace function public.hq_users() returns table (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz, confirmed boolean,
  kind text, name text, tier text, comp_tier text, founding boolean, listed boolean, location text,
  sub_status text, sub_tier text, sub_billing text, next_charge date, pending_deletion boolean, old_admin boolean
)
language sql stable security definer set search_path = public as $$
  select au.id, au.email::text, au.created_at, au.last_sign_in_at, au.banned_until, au.email_confirmed_at is not null,
    case when p.id is not null then 'creative' when c.id is not null then 'client' else 'unfinished' end,
    coalesce(nullif(p.business_name, ''), nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.company_name),
    lower(coalesce(p.subscription_tier, case when p.id is not null then 'basic' end)), p.comp_tier, coalesce(p.founding_member, false),
    coalesce(p.is_listed, false), nullif(concat_ws(', ', nullif(p.city, ''), nullif(p.state, '')), ''),
    s.status, s.tier, s.billing, s.next_charge_date,
    coalesce(p.pending_deletion, c.pending_deletion, false),
    coalesce(p.is_admin, false) or coalesce(p.role, '') in ('admin', 'staff')
  from auth.users au
  left join public.profiles p on p.id = au.id
  left join public.client_accounts c on c.id = au.id
  left join lateral (select status, tier, billing, next_charge_date from public.subscriptions where user_id = au.id order by updated_at desc nulls last limit 1) s on true
  where not exists (select 1 from public.hq_staff st where st.user_id = au.id)
  order by au.created_at desc
$$;

-- Founding creatives and how they are tracking against their commitments.
create or replace function public.hq_founding_status() returns table (
  id uuid, business_name text, business_email text, deal_status text, founding_member_since timestamptz,
  listing_complete boolean, job_count integer, last_feedback_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.business_name, p.business_email, coalesce(p.founding_deal_status, 'active'), p.founding_member_since,
    public.founding_listing_complete(p.id), public.founding_job_count(p.id),
    (select max(f.created_at) from public.founding_feedback f where f.creative_id = p.id)
  from public.profiles p where p.founding_member = true
  order by p.founding_member_since desc nulls last
$$;

-- The scheduled jobs and how their last run went. Never returns the command (it holds the secret).
create or replace function public.hq_cron_status() returns table (
  jobname text, schedule text, active boolean, last_start timestamptz, last_end timestamptz, last_status text, last_message text, fails_7d integer
)
language sql stable security definer set search_path = public, cron as $$
  select j.jobname::text, j.schedule::text, j.active,
    r.start_time, r.end_time, r.status::text, left(r.return_message, 200),
    (select count(*)::int from cron.job_run_details f where f.jobid = j.jobid and f.status = 'failed' and f.start_time > now() - interval '7 days')
  from cron.job j
  left join lateral (select start_time, end_time, status, return_message from cron.job_run_details d where d.jobid = j.jobid order by start_time desc limit 1) r on true
  order by j.jobname
$$;

revoke all on function public.hq_overview(), public.hq_users(), public.hq_founding_status(), public.hq_cron_status() from public, anon, authenticated;
grant execute on function public.hq_overview(), public.hq_users(), public.hq_founding_status(), public.hq_cron_status() to service_role;
revoke all on function public.hq_keep_apart(), public.hq_staff_is_apart(), public.hq_protect_owner(), public.hq_audit_append_only() from public, anon, authenticated;

-- Does this address already have any LensTrybe login? Staff need an address of their own.
create or replace function public.hq_email_taken(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email))
$$;
revoke all on function public.hq_email_taken(text) from public, anon, authenticated;
grant execute on function public.hq_email_taken(text) to service_role;
