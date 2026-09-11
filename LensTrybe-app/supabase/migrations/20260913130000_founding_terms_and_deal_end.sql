-- Founding 100 terms: recorded acceptance, and what happens when a founding deal ends.
--
--  * founding_terms_acceptances: one row per founding signup, with the terms version the
--    creative ticked and the time the account was created (server time). Written by
--    handle_new_user when a founding code is redeemed. Service role only.
--  * founding_end_deal(profile): the single way a founding deal ends (the End founding deal
--    button and the automatic revert in founding-check both use it). Matching the Founding
--    Creative Agreement: the $49 rate goes, and the free period ends. The first payment at
--    the standard price is taken 7 days after the deal ends (or on the original date if
--    that's sooner). The badge, profile and work stay.

create table if not exists public.founding_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invite_id uuid references public.founding_invites(id) on delete set null,
  code text,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text
);
create index if not exists founding_terms_acceptances_user_idx on public.founding_terms_acceptances (user_id);
alter table public.founding_terms_acceptances enable row level security;

-- End a founding deal. Returns what changed so the caller can email the creative.
create or replace function public.founding_end_deal(p_profile uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record;
  s record;
  v_cutoff date := (now() at time zone 'Australia/Brisbane')::date + 7;
  v_amount int;
  v_first date;
begin
  select id, founding_member, founding_deal_status, subscription_tier, next_billing_date into p
    from public.profiles where id = p_profile for update;
  if p.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not coalesce(p.founding_member, false) or p.founding_deal_status = 'reverted' then
    return jsonb_build_object('ok', false, 'error', 'already_ended');
  end if;

  update public.profiles set
    founding_deal_status = 'reverted',
    next_billing_date = case when next_billing_date is not null and next_billing_date > v_cutoff then v_cutoff else next_billing_date end
  where id = p_profile;

  select id, tier, billing, status, next_charge_date, current_period_end into s
    from public.subscriptions where user_id = p_profile for update;
  if s.id is not null then
    v_amount := case lower(coalesce(s.tier, 'expert'))
      when 'pro' then case when s.billing = 'annual' then 24990 else 2499 end
      when 'elite' then case when s.billing = 'annual' then 149990 else 14999 end
      else case when s.billing = 'annual' then 74990 else 7499 end
    end;
    v_first := case
      when s.status in ('trialing', 'active', 'past_due') and s.next_charge_date is not null and s.next_charge_date > v_cutoff then v_cutoff
      else s.next_charge_date
    end;
    update public.subscriptions set
      founding_member = false,
      amount_minor = v_amount,
      next_charge_date = v_first,
      current_period_end = case
        when status = 'trialing' and v_first is not null and current_period_end > (v_first::timestamp at time zone 'Australia/Brisbane')
          then (v_first::timestamp at time zone 'Australia/Brisbane')
        else current_period_end end,
      -- The deal-ended email covers the upcoming charge, so skip the separate reminder.
      reminder_sent_for = coalesce(v_first, reminder_sent_for),
      updated_at = now()
    where id = s.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'has_subscription', s.id is not null,
    'status', s.status,
    'tier', coalesce(s.tier, p.subscription_tier),
    'billing', s.billing,
    'amount_minor', v_amount,
    'first_charge_date', v_first
  );
end $$;
revoke all on function public.founding_end_deal(uuid) from public, anon, authenticated;
grant execute on function public.founding_end_deal(uuid) to service_role;

-- Signup: record which founding terms version the creative accepted.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account_type text := coalesce(nullif(meta->>'account_type', ''), nullif(meta->>'account_kind', ''));
  v_code text := upper(trim(coalesce(meta->>'founding_code', '')));
  v_chosen text := lower(coalesce(nullif(meta->>'subscription_tier', ''), 'basic'));
  v_granted boolean := false;
  v_invite_id uuid;
begin
  if v_account_type = 'creative' then
    insert into public.profiles (
      id, business_name, subscription_tier, account_type,
      display_name_preference, country, city, state
    )
    values (
      new.id,
      nullif(meta->>'business_name', ''),
      'basic',
      'creative',
      coalesce(nullif(meta->>'display_name_preference', ''), 'business_only'),
      coalesce(nullif(meta->>'country', ''), 'Australia'),
      nullif(meta->>'city', ''),
      nullif(meta->>'state', '')
    )
    on conflict (id) do nothing;

    if v_code <> '' then
      select id into v_invite_id from public.founding_invites
       where code = v_code and status = 'unused' and (expires_at is null or expires_at > now())
       limit 1;
      if v_invite_id is not null then
        update public.profiles set
          subscription_tier = 'expert',
          subscription_status = 'active',
          founding_member = true,
          founding_member_since = now(),
          show_founding_badge = true,
          next_billing_date = (now() + interval '12 months')::date
        where id = new.id;
        update public.founding_invites set status = 'redeemed', redeemed_by = new.id, redeemed_at = now()
         where id = v_invite_id and status = 'unused';
        insert into public.founding_terms_acceptances (user_id, invite_id, code, terms_version, accepted_at, user_agent)
        values (new.id, v_invite_id, v_code,
                coalesce(nullif(meta->>'founding_terms_version', ''), 'unspecified'),
                now(), left(nullif(meta->>'founding_terms_ua', ''), 400));
        v_granted := true;
      end if;
    end if;

    if not v_granted and v_chosen in ('pro', 'expert', 'elite') then
      update public.profiles set next_billing_date = (now() + interval '3 months')::date
       where id = new.id and next_billing_date is null;
    end if;

  elsif v_account_type = 'client' then
    insert into public.client_accounts (id, email, first_name, last_name, company_name)
    values (new.id, new.email, nullif(meta->>'first_name', ''), nullif(meta->>'last_name', ''), nullif(meta->>'company_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end $$;

-- Cancelling ends the founding deal (Founding Creative Agreement section 6), which frees the
-- founding place straight away. Access to the end of the period is handled by billing as usual.
create or replace function public.founding_deal_end_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status in ('canceled', 'cancelled') and coalesce(OLD.status, '') not in ('canceled', 'cancelled') then
    update public.profiles set founding_deal_status = 'reverted'
     where id = NEW.user_id and founding_member = true and founding_deal_status <> 'reverted';
  end if;
  return NEW;
end $$;
drop trigger if exists z_founding_deal_end_on_cancel on public.subscriptions;
create trigger z_founding_deal_end_on_cancel after update of status on public.subscriptions
  for each row execute function public.founding_deal_end_on_cancel();
