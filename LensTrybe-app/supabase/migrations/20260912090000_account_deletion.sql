-- Account deletion: 30-day grace window, reactivation, final purge, data export.

-- 1. Service-only bookkeeping tables ------------------------------------------
create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('creative', 'client')),
  status text not null default 'scheduled' check (status in ('scheduled', 'reactivated', 'purged')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  reminder_sent_at timestamptz,
  reactivated_at timestamptz,
  purged_at timestamptz,
  reason text,
  tier_at_request text,
  restore jsonb,
  purge_error text
);
create unique index if not exists account_deletions_one_open on public.account_deletions (user_id) where status = 'scheduled';
create index if not exists account_deletions_due on public.account_deletions (status, scheduled_for);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

create table if not exists public.account_action_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.account_action_codes enable row level security;
revoke all on public.account_action_codes from anon, authenticated;

-- 2. Client accounts get the same pending flags, protected from client writes --
alter table public.client_accounts
  add column if not exists pending_deletion boolean not null default false,
  add column if not exists deletion_scheduled_at timestamptz;

create or replace function public.guard_client_account_deletion()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    NEW.pending_deletion := false;
    NEW.deletion_scheduled_at := null;
    return NEW;
  end if;
  NEW.pending_deletion := OLD.pending_deletion;
  NEW.deletion_scheduled_at := OLD.deletion_scheduled_at;
  return NEW;
end $$;

drop trigger if exists a_guard_client_account_deletion on public.client_accounts;
create trigger a_guard_client_account_deletion
  before insert or update on public.client_accounts
  for each row execute function public.guard_client_account_deletion();

-- 3. Helpers used by policies -------------------------------------------------
create or replace function public.account_is_active(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles p
    where p.id = p_uid and coalesce(p.pending_deletion, false)
  )
$$;
revoke all on function public.account_is_active(uuid) from public;
grant execute on function public.account_is_active(uuid) to anon, authenticated, service_role;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.is_admin = true or p.role in ('admin', 'staff'))
  )
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated, service_role;

-- 4. Accounts pending deletion disappear from every public surface -------------
drop policy if exists "Anon can read profiles" on public.profiles;
drop policy if exists "Public can view profile business name" on public.profiles;
drop policy if exists "Public can view profiles" on public.profiles;
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select to anon, authenticated
  using (coalesce(pending_deletion, false) = false or id = auth.uid() or public.is_staff());

alter policy "Anon can read portfolio items" on public.portfolio_items
  using (public.account_is_active(coalesce(creative_id, user_id)));
alter policy "Anyone can view portfolio items" on public.portfolio_items
  using (public.account_is_active(coalesce(creative_id, user_id)));
alter policy "Public can view portfolio items" on public.portfolio_items
  using (public.account_is_active(coalesce(creative_id, user_id)));

alter policy "Anon can read reviews" on public.reviews
  using (public.account_is_active(creative_id));

alter policy "Public can view listings" on public.gear_listings
  using (status = 'active' and public.account_is_active(creative_id));
alter policy "Anyone can view active job listings" on public.job_listings
  using (status = 'active' and public.account_is_active(posted_by));
alter policy "Anyone can view active listings" on public.marketplace_listings
  using (status = 'active' and public.account_is_active(creative_id));
alter policy "Anyone can view active marketplace listings" on public.marketplace_listings
  using (status = 'active' and public.account_is_active(creative_id));
alter policy "Authenticated users can view open collaborations" on public.collaborations
  using (auth.role() = 'authenticated' and public.account_is_active(posted_by));

-- 5. Foreign keys that blocked removing a user ---------------------------------
alter table public.message_threads drop constraint if exists message_threads_creative_id_fkey;
alter table public.message_threads add constraint message_threads_creative_id_fkey
  foreign key (creative_id) references public.profiles (id) on delete cascade;
alter table public.message_threads drop constraint if exists message_threads_client_user_id_fkey;
alter table public.message_threads add constraint message_threads_client_user_id_fkey
  foreign key (client_user_id) references auth.users (id) on delete set null;
alter table public.message_threads drop constraint if exists message_threads_sender_user_id_fkey;
alter table public.message_threads add constraint message_threads_sender_user_id_fkey
  foreign key (sender_user_id) references auth.users (id) on delete set null;
alter table public.client_portals drop constraint if exists client_portals_creative_id_fkey;
alter table public.client_portals add constraint client_portals_creative_id_fkey
  foreign key (creative_id) references public.profiles (id) on delete cascade;
alter table public.brand_kit drop constraint if exists brand_kit_creative_id_fkey;
alter table public.brand_kit add constraint brand_kit_creative_id_fkey
  foreign key (creative_id) references public.profiles (id) on delete cascade;
alter table public.deliveries drop constraint if exists deliveries_creative_id_fkey;
alter table public.deliveries add constraint deliveries_creative_id_fkey
  foreign key (creative_id) references public.profiles (id) on delete cascade;
alter table public.team_members drop constraint if exists team_members_creative_id_fkey;
alter table public.team_members add constraint team_members_creative_id_fkey
  foreign key (creative_id) references public.profiles (id) on delete cascade;

-- 6. Every stored file that belongs to an account (service role only) ----------
create or replace function public.account_storage_objects(p_uid uuid)
returns table (bucket_id text, name text, size bigint)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0)
  from storage.objects o
  where o.bucket_id <> 'newsletter'
    and (
      o.owner = p_uid
      or o.owner_id = p_uid::text
      or split_part(o.name, '/', 1) = p_uid::text
      or (split_part(o.name, '/', 1) in ('contracts', 'uploaded_contracts', 'credentials', 'deliveries')
          and split_part(o.name, '/', 2) = p_uid::text)
    )
$$;
revoke all on function public.account_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.account_storage_objects(uuid) to service_role;
