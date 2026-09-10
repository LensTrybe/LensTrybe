-- Plan-tier source of truth + privilege guard on profiles.
--
-- 1. profiles.subscription_tier is the ACCESS tier (what gating, the sidebar and
--    Edge Functions read). subscriptions.tier is the BILLED tier.
-- 2. profiles.comp_tier is a complimentary floor set by an admin. A BEFORE trigger
--    keeps subscription_tier at or above comp_tier, so a renewal or plan change
--    written by the billing functions can never silently undo a comp.
-- 3. Browser clients (roles anon / authenticated) can no longer write billing,
--    access or admin columns on their own profile. Previously any signed-in user
--    could set their own subscription_tier, role or is_admin from the console.
--    Server code (service_role, SECURITY DEFINER functions) is unaffected.
-- 4. referrals: the "Service role can manage referrals" policy applied to PUBLIC,
--    letting anyone insert or edit referral rows. service_role bypasses RLS anyway,
--    so the policy is dropped.

create or replace function public.tier_rank(t text)
returns int language sql immutable set search_path = public as $$
  select case lower(coalesce(t, 'basic'))
    when 'pro' then 1 when 'expert' then 2 when 'elite' then 3 when 'vip' then 3
    else 0 end
$$;

alter table public.profiles add column if not exists comp_tier text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_comp_tier_check') then
    alter table public.profiles add constraint profiles_comp_tier_check
      check (comp_tier is null or comp_tier in ('pro', 'expert', 'elite'));
  end if;
end $$;
comment on column public.profiles.comp_tier is
  'Complimentary access floor granted by an admin. subscription_tier is kept >= this.';

-- Runs first (triggers fire alphabetically): undo client writes to protected columns.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.subscription_tier        := 'basic';
    NEW.subscription_status      := 'active';
    NEW.comp_tier                := null;
    NEW.is_admin                 := false;
    NEW.role                     := 'user';
    NEW.founding_member          := false;
    NEW.founding_member_since    := null;
    NEW.pending_referral_rewards := 0;
    NEW.referred_by_code         := null;
    NEW.referral_code            := null;
    NEW.next_billing_date        := null;
    NEW.revolut_customer_id      := null;
    NEW.stripe_customer_id       := null;
    NEW.pending_deletion         := false;
    NEW.deletion_scheduled_at    := null;
    return NEW;
  end if;

  NEW.subscription_tier        := OLD.subscription_tier;
  NEW.subscription_status      := OLD.subscription_status;
  NEW.comp_tier                := OLD.comp_tier;
  NEW.is_admin                 := OLD.is_admin;
  NEW.role                     := OLD.role;
  NEW.founding_member          := OLD.founding_member;
  NEW.founding_member_since    := OLD.founding_member_since;
  NEW.pending_referral_rewards := OLD.pending_referral_rewards;
  NEW.referred_by_code         := OLD.referred_by_code;
  NEW.referral_code            := OLD.referral_code;
  NEW.next_billing_date        := OLD.next_billing_date;
  NEW.revolut_customer_id      := OLD.revolut_customer_id;
  NEW.stripe_customer_id       := OLD.stripe_customer_id;
  NEW.pending_deletion         := OLD.pending_deletion;
  NEW.deletion_scheduled_at    := OLD.deletion_scheduled_at;
  return NEW;
end $$;

-- Runs second: keep access at or above any complimentary tier.
create or replace function public.enforce_comp_tier()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.comp_tier is not null
     and public.tier_rank(NEW.subscription_tier) < public.tier_rank(NEW.comp_tier) then
    NEW.subscription_tier := NEW.comp_tier;
  end if;
  return NEW;
end $$;

drop trigger if exists a_guard_profile_privileged on public.profiles;
create trigger a_guard_profile_privileged
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

drop trigger if exists b_enforce_comp_tier on public.profiles;
create trigger b_enforce_comp_tier
  before insert or update on public.profiles
  for each row execute function public.enforce_comp_tier();

-- Backfill: anyone whose access tier is above their live billed tier was granted
-- that access by an admin, so record it as a comp.
update public.profiles p
   set comp_tier = lower(p.subscription_tier)
  from public.subscriptions s
 where s.user_id = p.id
   and s.status in ('active', 'trialing', 'past_due')
   and public.tier_rank(p.subscription_tier) > public.tier_rank(s.tier)
   and lower(p.subscription_tier) in ('pro', 'expert', 'elite');

drop policy if exists "Service role can manage referrals" on public.referrals;
