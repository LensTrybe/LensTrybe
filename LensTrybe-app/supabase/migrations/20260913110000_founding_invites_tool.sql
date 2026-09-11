-- Founding invites tool: 100 founding places, personal codes, invite + reminder emails.
--
--  * A place is taken by a live invite (status 'unused' and not past expires_at) or by a
--    founding creative who still has the deal (founding_member, deal not reverted, account
--    not being deleted, not an admin). Cancelled / expired invites and creatives who leave
--    free their place automatically.
--  * Codes expire 14 days after the invite is (re)sent. Drafts (never sent) don't expire.
--  * The invite tool itself is the founding-invites Edge Function (admin only) plus a daily
--    cron that sends the day-7 reminder and expires unused codes on day 14.
--  * The cron job 'founding-invites-daily' (0 23 * * * UTC, 9am Brisbane) was created live
--    by copying the founding-check-daily job's command with the URL swapped, so the cron
--    secret never lives in the repo.

alter table public.founding_invites add column if not exists first_name text;
alter table public.founding_invites add column if not exists personal_note text;
alter table public.founding_invites add column if not exists sent_at timestamptz;
alter table public.founding_invites add column if not exists last_sent_at timestamptz;
alter table public.founding_invites add column if not exists send_count int not null default 0;
alter table public.founding_invites add column if not exists reminded_at timestamptz;
alter table public.founding_invites add column if not exists expires_at timestamptz;
alter table public.founding_invites add column if not exists cancelled_at timestamptz;
alter table public.founding_invites add column if not exists email_error text;
alter table public.founding_invites add column if not exists invited_by uuid references public.profiles(id) on delete set null;

-- The two setup test codes never take a real place.
update public.founding_invites set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
 where code like 'TEST-FOUNDING-%' and status = 'unused';

do $$ begin
  alter table public.founding_invites add constraint founding_invites_status_check check (status in ('unused', 'redeemed', 'cancelled', 'expired'));
exception when duplicate_object then null; end $$;

-- One live or redeemed invite per email address.
create unique index if not exists founding_invites_active_email_uidx
  on public.founding_invites (lower(email)) where email is not null and status in ('unused', 'redeemed');

create or replace function public.founding_cap() returns int language sql immutable as $$ select 100 $$;

-- Places taken right now.
create or replace function public.founding_places_used()
returns int language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.founding_invites i
      where i.status = 'unused' and (i.expires_at is null or i.expires_at > now()))
    +
    (select count(*) from public.profiles p
      where p.founding_member = true
        and coalesce(p.founding_deal_status, 'active') <> 'reverted'
        and not coalesce(p.pending_deletion, false)
        and not coalesce(p.is_admin, false))
  )::int
$$;
revoke all on function public.founding_places_used() from public;
grant execute on function public.founding_places_used() to service_role;

-- Never let a new live invite go over the cap (the Edge Function checks first; this is
-- the backstop). Serialised with an advisory lock so two sends can't both take the last place.
create or replace function public.founding_invites_cap_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'unused' and (NEW.expires_at is null or NEW.expires_at > now())
     and (TG_OP = 'INSERT' or OLD.status <> 'unused' or (OLD.expires_at is not null and OLD.expires_at <= now())) then
    perform pg_advisory_xact_lock(hashtext('founding_places'));
    if public.founding_places_used() >= public.founding_cap() then
      raise exception 'FOUNDING_PLACES_FULL' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists a_founding_invites_cap on public.founding_invites;
create trigger a_founding_invites_cap before insert or update on public.founding_invites
  for each row execute function public.founding_invites_cap_guard();

-- Signup redemption honours expiry (same as before otherwise).
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
