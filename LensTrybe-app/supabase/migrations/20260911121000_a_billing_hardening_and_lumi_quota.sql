-- Group A security pass: billing state machine hardening + Lumi quota enforcement.
--
-- subscriptions:
--   failed_attempts / past_due_since : dunning. revolut-charge-due retries a past_due
--       sub daily and moves it to Basic after 3 failed attempts or 7 days past due.
--   charging_at : short-lived claim so two runs (or a double click) can never charge
--       the same subscription twice at once.
--   inflight_charge : the renewal charge that has been started with Revolut but has
--       not reached a final state yet ({order_id, amount, currency, tier, billing,
--       amount_minor, applying_downgrade, first_charge_pct, rewards, created_at}).
--   processed_order_ids : Revolut orders already applied to this subscription, so a
--       replayed webhook for an old order can never extend or revive a subscription.
alter table public.subscriptions add column if not exists failed_attempts integer not null default 0;
alter table public.subscriptions add column if not exists past_due_since timestamptz;
alter table public.subscriptions add column if not exists charging_at timestamptz;
alter table public.subscriptions add column if not exists inflight_charge jsonb;
alter table public.subscriptions add column if not exists processed_order_ids text[] not null default '{}';

-- Applies a COMPLETED renewal charge exactly once (called by revolut-charge-due and
-- revolut-webhook with the service role). Returns 'applied', 'already', 'mismatch',
-- 'bad_status' or 'missing'.
create or replace function public.revolut_apply_charge(p_sub uuid, p_order text, p_amount integer, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions%rowtype;
  c jsonb;
  v_downgrade boolean;
  v_tier text;
  v_billing text;
  v_amount_minor integer;
  v_base timestamptz;
  v_end timestamptz;
  v_referrer uuid;
begin
  select * into s from public.subscriptions where id = p_sub for update;
  if not found then return 'missing'; end if;
  if p_order = any(coalesce(s.processed_order_ids, '{}')) then return 'already'; end if;
  c := s.inflight_charge;
  if c is null or (c->>'order_id') is distinct from p_order then return 'mismatch'; end if;
  if (c->>'amount')::integer is distinct from p_amount
     or upper(coalesce(c->>'currency', 'AUD')) is distinct from upper(coalesce(p_currency, '')) then
    return 'mismatch';
  end if;
  if s.status not in ('active', 'trialing', 'past_due') then return 'bad_status'; end if;

  v_downgrade := coalesce((c->>'applying_downgrade')::boolean, false);
  v_tier := case when v_downgrade then c->>'tier' else s.tier end;
  v_billing := case when v_downgrade then c->>'billing' else s.billing end;
  v_amount_minor := case when v_downgrade then (c->>'amount_minor')::integer else s.amount_minor end;

  v_base := case when s.current_period_end is not null and s.current_period_end > now() then s.current_period_end else now() end;
  v_end := v_base + case when coalesce(c->>'billing', s.billing) = 'monthly' then interval '1 month' else interval '1 year' end;

  update public.subscriptions set
    status = 'active',
    tier = v_tier,
    billing = v_billing,
    amount_minor = v_amount_minor,
    pending_tier = case when v_downgrade then null else pending_tier end,
    pending_billing = case when v_downgrade then null else pending_billing end,
    pending_change_at = case when v_downgrade then null else pending_change_at end,
    first_charge_discount = case when coalesce((c->>'first_charge_pct')::integer, 0) > 0 then false else first_charge_discount end,
    revolut_last_order_id = p_order,
    current_period_end = v_end,
    next_charge_date = (v_end at time zone 'UTC')::date,
    failed_attempts = 0,
    past_due_since = null,
    inflight_charge = null,
    processed_order_ids = array_append(coalesce(processed_order_ids, '{}'), p_order),
    updated_at = now()
  where id = p_sub;

  update public.profiles set subscription_tier = v_tier, subscription_status = 'active' where id = s.user_id;

  -- Referred creative's first real charge: confirm the referral and credit the referrer.
  if coalesce((c->>'first_charge_pct')::integer, 0) > 0 then
    update public.referrals set status = 'confirmed', confirmed_at = now()
     where id = (select id from public.referrals where referred_user_id = s.user_id and status = 'pending' limit 1)
    returning referrer_id into v_referrer;
    if v_referrer is not null then perform public.award_referral(v_referrer); end if;
  end if;

  -- Redeem the referrer rewards that were applied to this charge.
  if coalesce((c->>'rewards')::integer, 0) > 0 then
    perform public.consume_referral_rewards(s.user_id, (c->>'rewards')::integer);
  end if;

  return 'applied';
end $$;
revoke execute on function public.revolut_apply_charge(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.revolut_apply_charge(uuid, text, integer, text) to service_role;

-- Lumi quota: the table was writable by its owner (anyone could reset their own
-- counters), and the Edge Function wrote columns that do not exist so nothing was
-- ever counted. Counters are now only changed by lumi_consume / lumi_release.
drop policy if exists "Users can insert own lumi usage" on public.lumi_usage;
drop policy if exists "Users can update own lumi usage" on public.lumi_usage;

-- Atomically rolls the counters over when the month/day changed (Brisbane time) and
-- consumes one message if the user is under both limits. A negative or null limit
-- means unlimited. Returns true if the message is allowed.
create or replace function public.lumi_consume(p_user uuid, p_month_limit integer, p_day_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Australia/Brisbane')::date;
  v_month date := date_trunc('month', (now() at time zone 'Australia/Brisbane'))::date;
  u public.lumi_usage%rowtype;
  v_monthly integer;
  v_daily integer;
begin
  if p_user is null then return false; end if;
  insert into public.lumi_usage (user_id, monthly_count, daily_count, month_reset_at, day_reset_at)
  values (p_user, 0, 0, v_month, v_today)
  on conflict (user_id) do nothing;

  select * into u from public.lumi_usage where user_id = p_user for update;
  v_monthly := case when u.month_reset_at is distinct from v_month then 0 else coalesce(u.monthly_count, 0) end;
  v_daily := case when u.day_reset_at is distinct from v_today then 0 else coalesce(u.daily_count, 0) end;

  if (p_month_limit is not null and p_month_limit >= 0 and v_monthly >= p_month_limit)
     or (p_day_limit is not null and p_day_limit >= 0 and v_daily >= p_day_limit) then
    update public.lumi_usage
       set monthly_count = v_monthly, daily_count = v_daily,
           month_reset_at = v_month, day_reset_at = v_today, updated_at = now()
     where user_id = p_user;
    return false;
  end if;

  update public.lumi_usage
     set monthly_count = v_monthly + 1, daily_count = v_daily + 1,
         month_reset_at = v_month, day_reset_at = v_today, updated_at = now()
   where user_id = p_user;
  return true;
end $$;
revoke execute on function public.lumi_consume(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.lumi_consume(uuid, integer, integer) to service_role;

-- Gives back one message when the AI call itself failed (not the user's fault).
create or replace function public.lumi_release(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lumi_usage
     set monthly_count = greatest(coalesce(monthly_count, 0) - 1, 0),
         daily_count = greatest(coalesce(daily_count, 0) - 1, 0),
         updated_at = now()
   where user_id = p_user;
end $$;
revoke execute on function public.lumi_release(uuid) from public, anon, authenticated;
grant execute on function public.lumi_release(uuid) to service_role;
