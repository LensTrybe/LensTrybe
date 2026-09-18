-- Let an invite code carry its own grant, so a code can mean "Elite, free for life"
-- instead of only ever meaning the founding offer.
--
-- Already applied live. This file is the record.
--
-- grant_tier null is the existing behaviour, exactly. The hundred founding codes already
-- out there have it null, so nothing about them changes: same expert tier, same twelve or
-- six months, same badge, same cap. Verified after applying: 104 codes, 104 with
-- grant_tier null.
--
-- A code that does carry a grant is deliberately NOT a founding place:
--   - founding_member stays false, so founding_places_used() does not count it and the
--     hundred places are not eaten by testers and partners
--   - no badge, which belongs to the founding hundred alone
--   - no founding_terms_acceptances row, because that records acceptance of the founding
--     creative agreement and a comped tester has not signed it
--
-- With grant_forever, the permanence comes from profiles.comp_tier and the existing
-- enforce_comp_tier trigger, not from a long billing date. Tested by setting comp_tier
-- and then trying to demote the account to basic: it came back elite.
alter table public.founding_invites
  add column if not exists grant_tier text,
  add column if not exists grant_forever boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'founding_invites_grant_tier_check') then
    alter table public.founding_invites
      add constraint founding_invites_grant_tier_check
      check (grant_tier is null or grant_tier in ('pro', 'expert', 'elite'));
  end if;
end $$;

comment on column public.founding_invites.grant_tier is
  'Null means the standard founding offer. Otherwise the tier this code grants on signup.';
comment on column public.founding_invites.grant_forever is
  'With grant_tier set, comps the tier permanently via profiles.comp_tier and leaves next_billing_date null.';

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
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
      select id, grant_tier, grant_forever
        into v_invite_id, v_grant_tier, v_grant_forever
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
          -- Same lock the invite cap guard takes, so two people redeeming at once cannot
          -- both read the last free place and both be given the full period.
          perform pg_advisory_xact_lock(hashtext('founding_places'));
          v_free_months := case
            when public.founding_places_used() < public.founding_cap() then 12
            else 6
          end;
          update public.profiles set
            subscription_tier = 'expert',
            subscription_status = 'active',
            founding_member = true,
            founding_member_since = now(),
            -- The badge is the founding 100's alone. The second tier keeps everything else.
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
end $function$;
