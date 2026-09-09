-- Founding creative feedback (their monthly-feedback responsibility, read in the admin panel)
create table if not exists public.founding_feedback (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles(id) on delete cascade,
  category text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.founding_feedback enable row level security;

drop policy if exists "founding_feedback insert own" on public.founding_feedback;
create policy "founding_feedback insert own" on public.founding_feedback
  for insert to authenticated with check (creative_id = auth.uid());

drop policy if exists "founding_feedback select own or admin" on public.founding_feedback;
create policy "founding_feedback select own or admin" on public.founding_feedback
  for select to authenticated using (
    creative_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Enforcement state on the profile.
alter table public.profiles add column if not exists founding_deal_status text not null default 'active';
alter table public.profiles add column if not exists founding_warned_at timestamptz;

-- Is a creative's listing complete? Single source of truth mirroring lib/profileCompleteness.
create or replace function public.founding_listing_complete(p_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    coalesce(nullif(trim(p.avatar_url), ''), '') <> ''
    and coalesce(nullif(trim(p.business_name), ''), '') <> ''
    and coalesce(nullif(trim(p.tagline), ''), '') <> ''
    and length(trim(coalesce(p.bio, ''))) >= 40
    and coalesce(array_length(p.skill_types, 1), 0) >= 1
    and coalesce(array_length(p.specialties, 1), 0) >= 1
    and coalesce(nullif(trim(p.city), ''), '') <> ''
    and coalesce(nullif(trim(p.state), ''), '') <> ''
    and (coalesce(nullif(trim(p.phone), ''), '') <> '' or coalesce(nullif(trim(p.website), ''), '') <> '')
    and (
      coalesce(nullif(trim(p.instagram_url), ''), '') <> '' or
      coalesce(nullif(trim(p.tiktok_url), ''), '') <> '' or
      coalesce(nullif(trim(p.linkedin_url), ''), '') <> '' or
      coalesce(nullif(trim(p.facebook_url), ''), '') <> '' or
      coalesce(nullif(trim(p.twitter_url), ''), '') <> ''
    )
    and (select count(*) from public.portfolio_items pi where pi.creative_id = p.id or pi.user_id = p.id) >= 8
  from public.profiles p where p.id = p_id
$$;

-- Count of qualifying "real jobs": distinct external clients who BOTH accepted a quote
-- AND paid an invoice from this creative (excludes the creative's own email).
create or replace function public.founding_job_count(p_id uuid)
returns integer language sql security definer set search_path = public stable as $$
  with own as (select lower(coalesce(business_email, '')) as em from public.profiles where id = p_id),
  accepted as (
    select distinct lower(client_email) as em from public.quotes
    where creative_id = p_id and lower(status) = 'accepted'
      and client_email is not null and trim(client_email) <> ''
  ),
  paid as (
    select distinct lower(client_email) as em from public.invoices
    where creative_id = p_id and lower(status) = 'paid'
      and client_email is not null and trim(client_email) <> ''
  )
  select count(*)::int from accepted a
  join paid pd on pd.em = a.em
  where a.em <> coalesce((select em from own), '')
$$;

grant execute on function public.founding_listing_complete(uuid) to authenticated;
grant execute on function public.founding_job_count(uuid) to authenticated;
