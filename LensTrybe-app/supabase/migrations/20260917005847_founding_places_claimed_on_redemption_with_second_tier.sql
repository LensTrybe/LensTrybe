-- A place is claimed by redeeming a code, not by holding one.
--
-- founding_places_used() counted live unused invites as well as active founders, so 100
-- outstanding codes filled all 100 places and no further invite could be issued. With
-- cold outreach converting in the low tens of percent, that capped the programme at far
-- fewer than 100 actual founding creatives and left the unredeemed places locked until
-- the codes expired, which was the day before launch.
--
-- Places now count only creatives who have actually redeemed. More codes than places can
-- be issued, and the first founding_cap() to redeem take the full deal. Anyone redeeming
-- after that still joins as a founding member on the same locked rate and keeps the
-- badge, with half the free months.

alter table public.profiles
  add column if not exists founding_free_months integer;

comment on column public.profiles.founding_free_months is
  'Free months granted when the founding code was redeemed: 12 for the first founding_cap() to redeem, 6 for anyone after. Null for creatives who never redeemed one.';

-- Existing founding members all redeemed under the original terms.
update public.profiles
   set founding_free_months = 12
 where founding_member = true
   and founding_free_months is null;

create or replace function public.founding_places_used()
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (
    select count(*) from public.profiles p
      where p.founding_member = true
        and coalesce(p.founding_deal_status, 'active') <> 'reverted'
        and not coalesce(p.pending_deletion, false)
        and not coalesce(p.is_admin, false)
  )::int
$function$;

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
          show_founding_badge = true,
          founding_free_months = v_free_months,
          next_billing_date = (now() + make_interval(months => v_free_months))::date
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
end $function$;
