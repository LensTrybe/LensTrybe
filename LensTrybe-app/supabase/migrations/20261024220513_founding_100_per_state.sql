-- Founding 100 per state (25 October 2026).
-- The founding places were 100 across Australia. They are now 100 in every state and territory
-- (NSW, VIC, QLD, WA, SA, TAS, ACT, NT; 800 in all). The state is set on the invite when it is
-- sent (HQ prefills it from where the creative is based), and the creative takes a place in that
-- state's 100 when they redeem. The first 100 to redeem in a state get 12 months free and the
-- badge; after that, in that state, 6 months free and no badge. Both then pay $49 a month for life.
-- Invites are no longer refused once places run out: the 6 month tier needs codes to keep going out.

-- 1. Where each invite and each founding creative counts
alter table public.founding_invites add column if not exists state text;
alter table public.profiles add column if not exists founding_state text;
do $$ begin
  alter table public.founding_invites add constraint founding_invites_state_check
    check (state is null or state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_founding_state_check
    check (founding_state is null or founding_state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT'));
exception when duplicate_object then null; end $$;

-- Turn a free-text place (a region, a city, a state) into a state code, or null.
create or replace function public.au_state_code(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when p is null or btrim(p) = '' then null
    when upper(btrim(p)) in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT') then upper(btrim(p))
    when p ~* '(new south wales|sydney|newcastle|wollongong|central coast|byron)' then 'NSW'
    when p ~* '(victoria|melbourne|geelong|ballarat|bendigo|mornington)' then 'VIC'
    when p ~* '(queensland|brisbane|gold coast|sunshine coast|cairns|townsville|toowoomba)' then 'QLD'
    when p ~* '(western australia|perth|fremantle)' then 'WA'
    when p ~* '(south australia|adelaide)' then 'SA'
    when p ~* '(tasmania|hobart|launceston)' then 'TAS'
    when p ~* '(australian capital|canberra)' then 'ACT'
    when p ~* '(northern territory|darwin|alice springs)' then 'NT'
    else null end
$$;

-- Everything before today was South East Queensland unless it says otherwise.
update public.founding_invites f set state = coalesce(
    (select public.au_state_code(p.state) from public.profiles p where p.id = f.redeemed_by),
    public.au_state_code(f.region), 'QLD')
  where f.state is null and f.grant_tier is null;
update public.profiles p set founding_state = coalesce(
    (select f.state from public.founding_invites f where f.redeemed_by = p.id and f.state is not null limit 1),
    public.au_state_code(p.state), 'QLD')
  where p.founding_member = true and p.founding_state is null;

-- 2. Places: 100 per state. founding_places_used() with no state stays the national total.
create or replace function public.founding_places_used(p_state text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles p
   where p.founding_member = true
     and p.founding_state = upper(p_state)
     and coalesce(p.founding_deal_status, 'active') <> 'reverted'
     and not coalesce(p.pending_deletion, false)
     and not coalesce(p.is_admin, false)
$$;

create or replace function public.founding_places_by_state()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_object_agg(s, jsonb_build_object('used', public.founding_places_used(s), 'cap', public.founding_cap(),
           'available', greatest(0, public.founding_cap() - public.founding_places_used(s))) order by o)
    from unnest(array['NSW','VIC','QLD','WA','SA','TAS','ACT','NT']) with ordinality as t(s, o)
$$;
grant execute on function public.founding_places_used(text) to anon, authenticated;
grant execute on function public.founding_places_by_state() to anon, authenticated;

-- What a code gives if it is used now: 12 months while its state has places, then 6.
-- null for an unknown, used or expired code, or a comped code (its own tier).
create or replace function public.founding_months_for_code(p_code text)
returns integer language sql stable security definer set search_path = public as $$
  select case when public.founding_places_used(f.state) < public.founding_cap() then 12 else 6 end
    from public.founding_invites f
   where f.code = upper(btrim(p_code)) and f.status = 'unused' and f.grant_tier is null
     and (f.expires_at is null or f.expires_at > now()) and f.state is not null
$$;
revoke execute on function public.founding_months_for_code(text) from public, anon, authenticated;

-- 3. A live founding invite must say which state it counts in. No cap here any more.
create or replace function public.founding_invites_cap_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'unused' and NEW.grant_tier is null and NEW.state is null then
    NEW.state := public.au_state_code(NEW.region);
    if NEW.state is null then
      raise exception 'FOUNDING_STATE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;

-- 4. Sign-up and the Founding hub grant 12 or 6 months by the invite's state, and record it.
create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account_type text := coalesce(nullif(meta->>'account_type', ''), nullif(meta->>'account_kind', ''));
  v_code text := upper(trim(coalesce(meta->>'founding_code', '')));
  v_chosen text := lower(coalesce(nullif(meta->>'subscription_tier', ''), 'basic'));
  v_granted boolean := false;
  v_invite_id uuid;
  v_free_months integer;
  v_grant_tier text;
  v_grant_forever boolean;
  v_state text;
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
      select id, grant_tier, grant_forever, state
        into v_invite_id, v_grant_tier, v_grant_forever, v_state
        from public.founding_invites
       where code = v_code and status = 'unused' and (expires_at is null or expires_at > now())
       limit 1;

      if v_invite_id is not null then
        if v_grant_tier is not null then
          -- A comped code. No founding place, no badge, and with grant_forever the
          -- comp_tier column plus the enforce_comp_tier trigger hold the tier for good.
          update public.profiles set
            subscription_tier = v_grant_tier,
            subscription_status = 'active',
            comp_tier = case when v_grant_forever then v_grant_tier else null end,
            next_billing_date = case when v_grant_forever then null
                                     else (now() + interval '12 months')::date end
          where id = new.id;
        else
          -- The place counts in the invite's state (100 per state). Fallback: where they said they are.
          v_state := coalesce(v_state, public.au_state_code(meta->>'state'), 'QLD');
          -- Same lock the redeem path takes, so two people redeeming at once cannot
          -- both read the last free place in a state and both be given the full period.
          perform pg_advisory_xact_lock(hashtext('founding_places'));
          v_free_months := case
            when public.founding_places_used(v_state) < public.founding_cap() then 12
            else 6
          end;
          update public.profiles set
            subscription_tier = 'expert',
            subscription_status = 'active',
            founding_member = true,
            founding_member_since = now(),
            founding_state = v_state,
            -- The badge is each state's founding 100's alone. The second tier keeps everything else.
            show_founding_badge = (v_free_months = 12),
            founding_free_months = v_free_months,
            next_billing_date = (now() + make_interval(months => v_free_months))::date
          where id = new.id;
          insert into public.founding_terms_acceptances (user_id, invite_id, code, terms_version, accepted_at, user_agent)
          values (new.id, v_invite_id, v_code,
                  coalesce(nullif(meta->>'founding_terms_version', ''), 'unspecified'),
                  now(), left(nullif(meta->>'founding_terms_ua', ''), 400));
        end if;

        update public.founding_invites set status = 'redeemed', redeemed_by = new.id, redeemed_at = now()
         where id = v_invite_id and status = 'unused';
        v_granted := true;
      end if;
    end if;

    if not v_granted and v_chosen in ('pro', 'expert', 'elite') then
      update public.profiles set next_billing_date = (now() + interval '14 days')::date
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
end $function$;

create or replace function public.redeem_founding_code(p_code text, p_terms_version text default null::text, p_ua text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_prof record;
  v_inv record;
  v_months int;
  v_live boolean;
  v_state text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if v_code = '' or length(v_code) > 64 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.rate_limit_hit('founding-redeem:' || v_uid::text, 10, 600) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  select id, account_type, founding_member, comp_tier, pending_deletion, state into v_prof from public.profiles where id = v_uid for update;
  if v_prof.id is null or v_prof.account_type is distinct from 'creative' then return jsonb_build_object('ok', false, 'reason', 'not_creative'); end if;
  if v_prof.pending_deletion then return jsonb_build_object('ok', false, 'reason', 'deleting'); end if;
  if v_prof.founding_member then return jsonb_build_object('ok', false, 'reason', 'already_founding'); end if;

  -- someone already paying (or with a card saved for a trial) is moved over by hand, not here
  select exists (select 1 from public.subscriptions s where s.user_id = v_uid
                  and (s.status in ('active', 'past_due') or (s.status = 'trialing' and s.revolut_payment_method_id is not null))) into v_live;
  if v_live then return jsonb_build_object('ok', false, 'reason', 'has_subscription'); end if;

  select id, status, expires_at, grant_tier, grant_forever, state into v_inv from public.founding_invites where code = v_code for update;
  if v_inv.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_inv.status <> 'unused' then return jsonb_build_object('ok', false, 'reason', v_inv.status); end if;
  if v_inv.expires_at is not null and v_inv.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  if v_inv.grant_tier is not null then
    update public.profiles set
      subscription_tier = v_inv.grant_tier, subscription_status = 'active',
      comp_tier = case when v_inv.grant_forever then v_inv.grant_tier else null end,
      next_billing_date = case when v_inv.grant_forever then null else (now() + interval '12 months')::date end
    where id = v_uid;
    v_months := case when v_inv.grant_forever then null else 12 end;
  else
    v_state := coalesce(v_inv.state, public.au_state_code(v_prof.state), 'QLD');
    perform pg_advisory_xact_lock(hashtext('founding_places'));
    v_months := case when public.founding_places_used(v_state) < public.founding_cap() then 12 else 6 end;
    update public.profiles set
      subscription_tier = 'expert', subscription_status = 'active',
      founding_member = true, founding_member_since = now(), founding_state = v_state,
      show_founding_badge = (v_months = 12),
      founding_free_months = v_months,
      next_billing_date = (now() + make_interval(months => v_months))::date
    where id = v_uid;
    insert into public.founding_terms_acceptances (user_id, invite_id, code, terms_version, accepted_at, user_agent)
    values (v_uid, v_inv.id, v_code, coalesce(nullif(p_terms_version, ''), 'unspecified'), now(), left(nullif(p_ua, ''), 400));
  end if;

  update public.founding_invites set status = 'redeemed', redeemed_by = v_uid, redeemed_at = now() where id = v_inv.id and status = 'unused';
  return jsonb_build_object('ok', true, 'tier', coalesce(v_inv.grant_tier, 'expert'), 'months', v_months, 'founding', v_inv.grant_tier is null, 'badge', v_inv.grant_tier is null and v_months = 12, 'state', v_state);
end
$function$;

-- 5. HQ Overview: places across all 800, and per state.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.hq_overview'::regproc);
  d := replace(d, $r$'founding', jsonb_build_object('used', public.founding_places_used(), 'cap', public.founding_cap(),$r$,
                  $r$'founding', jsonb_build_object('used', public.founding_places_used(), 'cap', public.founding_cap() * 8, 'per_state', public.founding_cap(), 'by_state', public.founding_places_by_state(),$r$);
  if position('by_state' in d) = 0 then raise exception 'hq_overview anchor not found'; end if;
  execute d;
end
$do$;
