-- Profile fields on the public profile / website:
--  * phone becomes private (profile_private) and is only shown publicly when the
--    creative turns on show_phone (copied to profiles.public_phone by the trigger)
--  * blocked dates can be shown on the website without exposing notes or times

alter table public.profile_private add column if not exists phone text;
alter table public.profiles add column if not exists show_phone boolean not null default false;
alter table public.profiles add column if not exists public_phone text;

-- Move any existing phone numbers into the private table.
insert into public.profile_private (id, phone, updated_at)
select id, nullif(trim(phone), ''), now() from public.profiles where coalesce(trim(phone), '') <> ''
on conflict (id) do update set phone = excluded.phone, updated_at = now();

create or replace function public.profiles_redirect_private_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name, NEW.insurance_url,
              NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url) is not null then
    insert into public.profile_private as pp (id, bank_name, bank_bsb, bank_account, bank_account_name,
      insurance_url, blue_card_url, police_check_url, wwvp_url, drone_licence_url, other_url, updated_at)
    values (NEW.id, NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name,
      NEW.insurance_url, NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url, now())
    on conflict (id) do update set
      bank_name = coalesce(excluded.bank_name, pp.bank_name),
      bank_bsb = coalesce(excluded.bank_bsb, pp.bank_bsb),
      bank_account = coalesce(excluded.bank_account, pp.bank_account),
      bank_account_name = coalesce(excluded.bank_account_name, pp.bank_account_name),
      insurance_url = coalesce(excluded.insurance_url, pp.insurance_url),
      blue_card_url = coalesce(excluded.blue_card_url, pp.blue_card_url),
      police_check_url = coalesce(excluded.police_check_url, pp.police_check_url),
      wwvp_url = coalesce(excluded.wwvp_url, pp.wwvp_url),
      drone_licence_url = coalesce(excluded.drone_licence_url, pp.drone_licence_url),
      other_url = coalesce(excluded.other_url, pp.other_url),
      updated_at = now();
  end if;

  -- Phone: any value written to profiles.phone (including '' to clear it) goes to
  -- the private table. The profile row itself never keeps it.
  if TG_OP = 'UPDATE' and NEW.phone is not null then
    insert into public.profile_private as pp (id, phone, updated_at)
    values (NEW.id, nullif(trim(NEW.phone), ''), now())
    on conflict (id) do update set phone = excluded.phone, updated_at = now();
  end if;
  NEW.phone := null;

  -- Public copy of the phone number, only when the creative has chosen to show it.
  if coalesce(NEW.show_phone, false) then
    NEW.public_phone := (select pp.phone from public.profile_private pp where pp.id = NEW.id);
  else
    NEW.public_phone := null;
  end if;

  NEW.bank_name := null; NEW.bank_bsb := null; NEW.bank_account := null; NEW.bank_account_name := null;
  NEW.insurance_url := null; NEW.blue_card_url := null; NEW.police_check_url := null;
  NEW.wwvp_url := null; NEW.drone_licence_url := null; NEW.other_url := null;
  return NEW;
end $$;

update public.profiles set phone = null where phone is not null;

-- Upcoming unavailable dates for a creative's public profile (dates only).
create or replace function public.creative_unavailable_dates(p_creative uuid)
returns table (date date, all_day boolean)
language sql stable security definer set search_path = public as $$
  select a.date, coalesce(a.all_day, true)
  from public.availability a
  where a.creative_id = p_creative
    and coalesce(a.is_available, false) = false
    and a.date >= (now() at time zone 'Australia/Brisbane')::date
    and a.date < (now() at time zone 'Australia/Brisbane')::date + 90
    and public.account_is_active(p_creative)
  order by a.date
  limit 60
$$;
revoke all on function public.creative_unavailable_dates(uuid) from public;
grant execute on function public.creative_unavailable_dates(uuid) to anon, authenticated, service_role;

-- Founding listing check reads the phone from the private table now.
create or replace function public.founding_listing_complete(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(trim(p.avatar_url), ''), '') <> ''
    and coalesce(nullif(trim(p.business_name), ''), '') <> ''
    and coalesce(nullif(trim(p.tagline), ''), '') <> ''
    and length(trim(coalesce(p.bio, ''))) >= 40
    and coalesce(array_length(p.skill_types, 1), 0) >= 1
    and coalesce(array_length(p.specialties, 1), 0) >= 1
    and coalesce(nullif(trim(p.city), ''), '') <> ''
    and coalesce(nullif(trim(p.state), ''), '') <> ''
    and (coalesce(nullif(trim((select pp.phone from public.profile_private pp where pp.id = p.id)), ''), '') <> ''
         or coalesce(nullif(trim(p.website), ''), '') <> '')
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

-- A creative's website is live for everyone when they're on a paid plan and their
-- account is active. (portfolio_website_active was never switched on by the current
-- builder, so visitors couldn't see builder content or services, or enquire.)
create or replace function public.website_is_live(p_creative uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_creative
      and lower(coalesce(p.subscription_tier, 'basic')) in ('pro', 'expert', 'elite')
      and not coalesce(p.pending_deletion, false)
  )
$$;
revoke all on function public.website_is_live(uuid) from public;
grant execute on function public.website_is_live(uuid) to anon, authenticated, service_role;

alter policy "site_pages_public_read" on public.site_pages
  using (public.website_is_live(creative_id));
alter policy "portfolio_services_public_select_for_live_sites" on public.portfolio_services
  using (public.website_is_live(creative_id));
