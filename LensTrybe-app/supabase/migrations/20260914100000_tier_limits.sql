-- Plan limits, enforced by the database.
--
-- Until now the numbers on the pricing pages were advertising only: nothing stopped a
-- Basic creative uploading 400 photos, and the paid pages were reachable by URL because
-- the only check was the sidebar hiding a link. This makes the limits real.
--
-- tier_limits mirrors src/lib/tierFeatures.js. The two are kept in step by hand, so when
-- you change a number there, change it here in a new migration. NULL means unlimited, so
-- `used < limit` needs no special case and an unlimited plan is simply not checked.
--
-- Decided by Michael, 12 September 2026 (the Tier Matrix review).

create table if not exists public.tier_limits (
  tier text primary key,
  bookings_per_month int,
  replies_per_month int,
  portfolio_photos int,
  portfolio_videos int,
  crm_records int,
  marketplace_listings int,
  team_seats int,
  deliver_gb int,
  imported_reviews int,
  quotes boolean not null default false,
  invoicing boolean not null default false,
  contracts boolean not null default false,
  client_portals boolean not null default false,
  brand_kit boolean not null default false,
  share_contact boolean not null default false,
  lumi boolean not null default false,
  website text not null default 'none'
);

alter table public.tier_limits enable row level security;
drop policy if exists tier_limits_read on public.tier_limits;
create policy tier_limits_read on public.tier_limits for select to authenticated, anon using (true);

insert into public.tier_limits (tier, bookings_per_month, replies_per_month, portfolio_photos,
  portfolio_videos, crm_records, marketplace_listings, team_seats, deliver_gb, imported_reviews,
  quotes, invoicing, contracts, client_portals, brand_kit, share_contact, lumi, website) values
  ('basic',  3,    5,    5,    0,    0,   0,    0, 0,   0,  false, false, false, false, false, false, false, 'none'),
  ('pro',    5,    20,   20,   1,    25,  5,    0, 1,   0,  false, false, false, false, false, false, false, 'onepage'),
  ('expert', null, null, 40,   5,    500, 15,   0, 50,  5,  true,  true,  true,  true,  true,  true,  true,  'full'),
  ('elite',  null, null, null, 10,   null, null, 5, 200, 10, true,  true,  true,  true,  true,  true,  true,  'full')
on conflict (tier) do update set
  bookings_per_month = excluded.bookings_per_month,
  replies_per_month = excluded.replies_per_month,
  portfolio_photos = excluded.portfolio_photos,
  portfolio_videos = excluded.portfolio_videos,
  crm_records = excluded.crm_records,
  marketplace_listings = excluded.marketplace_listings,
  team_seats = excluded.team_seats,
  deliver_gb = excluded.deliver_gb,
  imported_reviews = excluded.imported_reviews,
  quotes = excluded.quotes,
  invoicing = excluded.invoicing,
  contracts = excluded.contracts,
  client_portals = excluded.client_portals,
  brand_kit = excluded.brand_kit,
  share_contact = excluded.share_contact,
  lumi = excluded.lumi,
  website = excluded.website;

-- ---------------------------------------------------------------------------
-- Helpers. profiles.subscription_tier is already the effective tier: the
-- b_enforce_comp_tier trigger keeps it at or above any complimentary tier, so a
-- comped creative is never limited by what they are billed.
-- ---------------------------------------------------------------------------

create or replace function public.tier_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case lower(coalesce(subscription_tier, 'basic'))
           when 'vip' then 'elite'
           else lower(coalesce(subscription_tier, 'basic'))
         end
    from public.profiles where id = p_user
$$;

/** A numeric cap for a creative, or NULL when their plan has no cap. */
create or replace function public.tier_cap(p_user uuid, p_key text)
returns int language plpgsql stable security definer set search_path = public as $$
declare v_tier text := coalesce(public.tier_of(p_user), 'basic'); v_cap int;
begin
  select case p_key
    when 'bookings_per_month' then bookings_per_month
    when 'replies_per_month' then replies_per_month
    when 'portfolio_photos' then portfolio_photos
    when 'portfolio_videos' then portfolio_videos
    when 'crm_records' then crm_records
    when 'marketplace_listings' then marketplace_listings
    when 'team_seats' then team_seats
    when 'deliver_gb' then deliver_gb
    when 'imported_reviews' then imported_reviews
  end into v_cap from public.tier_limits where tier = v_tier;
  return v_cap;
end $$;

/** Does the creative's plan include a feature? */
create or replace function public.tier_allows(p_user uuid, p_flag text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_tier text := coalesce(public.tier_of(p_user), 'basic'); v_ok boolean;
begin
  select case p_flag
    when 'quotes' then quotes
    when 'invoicing' then invoicing
    when 'contracts' then contracts
    when 'client_portals' then client_portals
    when 'brand_kit' then brand_kit
    when 'share_contact' then share_contact
    when 'lumi' then lumi
    else false
  end into v_ok from public.tier_limits where tier = v_tier;
  return coalesce(v_ok, false);
end $$;

grant execute on function public.tier_of(uuid) to authenticated, service_role;
grant execute on function public.tier_cap(uuid, text) to authenticated, service_role;
grant execute on function public.tier_allows(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Feature gates. These raise TIER_REQUIRED:<feature>, which the app turns into an
-- upgrade prompt. They apply to every role, because the interface gate can be
-- bypassed by posting straight at the API and these are the paid features.
-- ---------------------------------------------------------------------------

create or replace function public.guard_tier_feature()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_flag text := TG_ARGV[0];
begin
  if not public.tier_allows(NEW.creative_id, v_flag) then
    raise exception 'TIER_REQUIRED:%', v_flag using errcode = 'P0001',
      hint = 'This feature is not included in the creative''s plan.';
  end if;
  return NEW;
end $$;

drop trigger if exists a_tier_quotes on public.quotes;
create trigger a_tier_quotes before insert on public.quotes
  for each row execute function public.guard_tier_feature('quotes');

drop trigger if exists a_tier_invoices on public.invoices;
create trigger a_tier_invoices before insert on public.invoices
  for each row execute function public.guard_tier_feature('invoicing');

drop trigger if exists a_tier_contracts on public.contracts;
create trigger a_tier_contracts before insert on public.contracts
  for each row execute function public.guard_tier_feature('contracts');

-- ---------------------------------------------------------------------------
-- Count caps. Each raises TIER_LIMIT:<what> so the app can name the right upgrade.
-- ---------------------------------------------------------------------------

create or replace function public.guard_tier_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_key text := TG_ARGV[0];
  v_cap int := public.tier_cap(NEW.creative_id, v_key);
  v_used int;
begin
  if v_cap is null then return NEW; end if;   -- unlimited

  if v_key = 'portfolio_photos' then
    select count(*) into v_used from public.portfolio_items
      where creative_id = NEW.creative_id and coalesce(file_type, 'image') <> 'video' and id <> NEW.id;
  elsif v_key = 'portfolio_videos' then
    select count(*) into v_used from public.portfolio_items
      where creative_id = NEW.creative_id and file_type = 'video' and id <> NEW.id;
  elsif v_key = 'crm_records' then
    select count(*) into v_used from public.crm_contacts
      where creative_id = NEW.creative_id and id <> NEW.id;
  elsif v_key = 'marketplace_listings' then
    select count(*) into v_used from public.marketplace_listings
      where creative_id = NEW.creative_id and coalesce(status, 'active') = 'active' and id <> NEW.id;
  elsif v_key = 'team_seats' then
    select count(*) into v_used from public.team_members
      where creative_id = NEW.creative_id and coalesce(status, 'active') <> 'removed' and id <> NEW.id;
  else
    return NEW;
  end if;

  if v_used >= v_cap then
    raise exception 'TIER_LIMIT:%', v_key using errcode = 'P0001',
      hint = format('This plan allows %s.', v_cap);
  end if;
  return NEW;
end $$;

-- Portfolio: photos and videos counted separately, since the plans sell them separately.
drop trigger if exists a_tier_photos on public.portfolio_items;
create trigger a_tier_photos before insert on public.portfolio_items
  for each row when (coalesce(NEW.file_type, 'image') <> 'video')
  execute function public.guard_tier_count('portfolio_photos');

drop trigger if exists a_tier_videos on public.portfolio_items;
create trigger a_tier_videos before insert on public.portfolio_items
  for each row when (NEW.file_type = 'video')
  execute function public.guard_tier_count('portfolio_videos');

drop trigger if exists a_tier_marketplace on public.marketplace_listings;
create trigger a_tier_marketplace before insert on public.marketplace_listings
  for each row execute function public.guard_tier_count('marketplace_listings');

drop trigger if exists a_tier_team on public.team_members;
create trigger a_tier_team before insert on public.team_members
  for each row execute function public.guard_tier_count('team_seats');

-- CRM is the one exception to "applies to every role". Enquiries are captured into the
-- CRM automatically by send-enquiry and site-enquiry, and a creative sitting on their
-- record cap must never cause an incoming enquiry to fail. So the cap applies to records
-- the creative adds themselves, and automatic capture is allowed through.
create or replace function public.guard_crm_records()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap int; v_used int;
begin
  if coalesce(auth.role(), '') = 'service_role' then return NEW; end if;
  v_cap := public.tier_cap(NEW.creative_id, 'crm_records');
  if v_cap is null then return NEW; end if;
  select count(*) into v_used from public.crm_contacts
    where creative_id = NEW.creative_id and id <> NEW.id;
  if v_used >= v_cap then
    raise exception 'TIER_LIMIT:crm_records' using errcode = 'P0001',
      hint = format('This plan allows %s client records.', v_cap);
  end if;
  return NEW;
end $$;

drop trigger if exists a_tier_crm on public.crm_contacts;
create trigger a_tier_crm before insert on public.crm_contacts
  for each row execute function public.guard_crm_records();

-- ---------------------------------------------------------------------------
-- Deliver storage. Sizes live in the delivery's files array, so the cap is the sum
-- across a creative's deliveries plus whatever this write adds.
-- ---------------------------------------------------------------------------

create or replace function public.delivery_bytes_used(p_creative uuid, p_exclude uuid default null)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum((f->>'size')::bigint), 0)
    from public.deliveries d, lateral jsonb_array_elements(coalesce(d.files, '[]'::jsonb)) f
   where d.creative_id = p_creative
     and (p_exclude is null or d.id <> p_exclude)
     and jsonb_typeof(coalesce(d.files, '[]'::jsonb)) = 'array'
$$;
grant execute on function public.delivery_bytes_used(uuid, uuid) to authenticated, service_role;

create or replace function public.guard_deliver_storage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap int := public.tier_cap(NEW.creative_id, 'deliver_gb');
  v_used bigint;
  v_adding bigint := 0;
begin
  if v_cap is null then return NEW; end if;

  if jsonb_typeof(coalesce(NEW.files, '[]'::jsonb)) = 'array' then
    select coalesce(sum((f->>'size')::bigint), 0) into v_adding
      from jsonb_array_elements(coalesce(NEW.files, '[]'::jsonb)) f;
  end if;

  v_used := public.delivery_bytes_used(NEW.creative_id, NEW.id);

  if v_used + v_adding > v_cap::bigint * 1024 * 1024 * 1024 then
    raise exception 'TIER_LIMIT:deliver_gb' using errcode = 'P0001',
      hint = format('This plan includes %sGB of Deliver storage.', v_cap);
  end if;
  return NEW;
end $$;

drop trigger if exists a_tier_deliver on public.deliveries;
create trigger a_tier_deliver before insert or update of files on public.deliveries
  for each row execute function public.guard_deliver_storage();

-- ---------------------------------------------------------------------------
-- Bookings: the cap is now per plan rather than Basic only. Basic 3 a month, Pro 5,
-- Expert and Elite unlimited. Requests still arrive at any plan; this only limits
-- what a creative can confirm.
-- ---------------------------------------------------------------------------

create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_cap int;
  v_used int;
  v_month_start timestamptz;
begin
  if not v_service then
    -- Direct writes come from the creative (RLS). They can't set or change the client's
    -- account link or the client's own request fields.
    if TG_OP = 'INSERT' then
      NEW.origin := 'creative';
      NEW.client_user_id := null;
      NEW.message := null;
    else
      NEW.creative_id := OLD.creative_id;
      NEW.origin := OLD.origin;
      NEW.client_user_id := OLD.client_user_id;
      NEW.message := OLD.message;
      NEW.created_at := OLD.created_at;
    end if;
  end if;

  if NEW.all_day then
    NEW.start_time := null;
    NEW.end_time := null;
  end if;

  -- Status timestamps.
  if TG_OP = 'INSERT' or NEW.status is distinct from OLD.status then
    if NEW.status in ('confirmed', 'completed') then
      NEW.confirmed_at := coalesce(NEW.confirmed_at, now());
      if NEW.origin = 'client' then NEW.responded_at := coalesce(NEW.responded_at, now()); end if;
    elsif NEW.status = 'declined' then
      NEW.responded_at := now();
    elsif NEW.status = 'cancelled' then
      NEW.cancelled_at := now();
    end if;
  end if;
  NEW.updated_at := now();

  -- Monthly confirm cap for the creative's plan (Brisbane calendar month).
  if NEW.status = 'confirmed' and (TG_OP = 'INSERT' or OLD.status is distinct from 'confirmed') then
    v_cap := public.tier_cap(NEW.creative_id, 'bookings_per_month');
    if v_cap is not null then
      v_month_start := (date_trunc('month', now() at time zone 'Australia/Brisbane')) at time zone 'Australia/Brisbane';
      select count(*) into v_used from public.bookings b
        where b.creative_id = NEW.creative_id
          and b.id <> NEW.id
          and b.status in ('confirmed', 'completed')
          and b.confirmed_at >= v_month_start;
      if v_used >= v_cap then
        raise exception 'BOOKING_LIMIT' using errcode = 'P0001',
          hint = format('This plan can confirm %s bookings a month.', v_cap);
      end if;
    end if;
  end if;
  return NEW;
end $$;

-- ---------------------------------------------------------------------------
-- Message replies read their cap from tier_limits too, so the monthly number lives
-- in one place rather than being written into the trigger.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_creative_message_monthly_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_creative_id uuid;
  v_count integer;
  v_limit integer;
begin
  select creative_id into v_creative_id from message_threads where id = new.thread_id;
  if v_creative_id is null or v_creative_id <> auth.uid() then return new; end if;
  if new.sender_type <> 'creative' then return new; end if;

  v_limit := public.tier_cap(v_creative_id, 'replies_per_month');
  if v_limit is null then return new; end if;

  v_count := count_creative_replies_this_utc_month(v_creative_id);
  if v_count >= v_limit then
    raise exception 'You have reached your monthly message limit. Upgrade your plan to send more messages.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- The monthly confirm cap means a creative at their limit leaves client requests
-- unanswered. booking-nudges emails those clients after 72 hours so silence is not
-- the experience. One email per booking, tracked here.
-- ---------------------------------------------------------------------------

alter table public.bookings add column if not exists client_nudge_sent_at timestamptz;

create index if not exists bookings_pending_nudge_idx
  on public.bookings (created_at)
  where status = 'pending' and origin = 'client' and client_nudge_sent_at is null;
