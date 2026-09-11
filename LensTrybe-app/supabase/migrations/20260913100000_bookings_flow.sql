-- Bookings: request-to-book from clients, bookings added by creatives, and busy times.
--
--  * Clients REQUEST a booking (date, optional start/end time, service, location, message).
--    The creative accepts or declines. Creatives can also add bookings themselves.
--  * Client-side writes go through the `bookings` Edge Function (service role). Creatives
--    can read and edit their own bookings directly; the guard below keeps the client's
--    own fields (who they are, what they asked for) out of the creative's reach.
--  * Confirmed bookings block only their booked hours (all-day bookings block the day).
--  * Basic creatives can confirm up to 3 bookings per calendar month (Brisbane time).

alter table public.bookings add column if not exists client_user_id uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists all_day boolean not null default true;
alter table public.bookings add column if not exists start_time time;
alter table public.bookings add column if not exists end_time time;
alter table public.bookings add column if not exists location text;
alter table public.bookings add column if not exists origin text not null default 'creative';
alter table public.bookings add column if not exists message text;
alter table public.bookings add column if not exists client_phone text;
alter table public.bookings add column if not exists response_note text;
alter table public.bookings add column if not exists responded_at timestamptz;
alter table public.bookings add column if not exists confirmed_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancelled_by text;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

-- Normalise any old status values before the check constraint.
update public.bookings set status = 'cancelled' where status in ('canceled');
update public.bookings set status = 'declined' where status in ('rejected');
update public.bookings set status = 'confirmed' where status in ('accepted');
update public.bookings set status = 'pending' where status is null or status not in ('pending', 'confirmed', 'declined', 'cancelled', 'completed');
alter table public.bookings alter column status set not null;

do $$ begin
  alter table public.bookings add constraint bookings_status_check check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bookings add constraint bookings_origin_check check (origin in ('client', 'creative'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bookings add constraint bookings_times_check check (all_day or (start_time is not null and end_time is not null and end_time > start_time));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bookings add constraint bookings_cancelled_by_check check (cancelled_by is null or cancelled_by in ('client', 'creative'));
exception when duplicate_object then null; end $$;

delete from public.bookings where creative_id is null;
alter table public.bookings alter column creative_id set not null;

create index if not exists bookings_creative_date_idx on public.bookings (creative_id, booking_date);
create index if not exists bookings_client_user_idx on public.bookings (client_user_id) where client_user_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: creatives manage their own bookings.
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;
drop policy if exists "Users can manage their own bookings" on public.bookings;
drop policy if exists bookings_creative_all on public.bookings;
drop policy if exists bookings_client_select on public.bookings;
create policy bookings_creative_all on public.bookings for all to authenticated
  using (creative_id = auth.uid()) with check (creative_id = auth.uid());
-- Clients don't get a SELECT policy: the row holds the creative's private notes. They
-- read their bookings through my_client_bookings() below, which leaves those out.

-- ---------------------------------------------------------------------------
-- Guard + bookkeeping (runs for every write, including the Edge Function).
-- ---------------------------------------------------------------------------
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_tier text;
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

  -- Basic plan: up to 3 confirmed bookings per calendar month (Brisbane time).
  if NEW.status = 'confirmed' and (TG_OP = 'INSERT' or OLD.status is distinct from 'confirmed') then
    select lower(coalesce(subscription_tier, 'basic')) into v_tier from public.profiles where id = NEW.creative_id;
    if coalesce(v_tier, 'basic') not in ('pro', 'expert', 'elite') then
      v_month_start := (date_trunc('month', now() at time zone 'Australia/Brisbane')) at time zone 'Australia/Brisbane';
      select count(*) into v_used from public.bookings b
        where b.creative_id = NEW.creative_id
          and b.id <> NEW.id
          and b.status in ('confirmed', 'completed')
          and b.confirmed_at >= v_month_start;
      if v_used >= 3 then
        raise exception 'BOOKING_LIMIT_BASIC' using errcode = 'P0001',
          hint = 'Basic plan creatives can confirm up to 3 bookings a month.';
      end if;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists a_bookings_guard on public.bookings;
create trigger a_bookings_guard before insert or update on public.bookings
  for each row execute function public.bookings_guard();

-- ---------------------------------------------------------------------------
-- Busy times for a creative's public calendar: blocked availability plus confirmed
-- bookings. Dates and times only, never who or what.
-- ---------------------------------------------------------------------------
create or replace function public.creative_busy_times(p_creative uuid, p_from date default null, p_to date default null)
returns table (date date, all_day boolean, start_time time, end_time time, source text)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select greatest(coalesce(p_from, (now() at time zone 'Australia/Brisbane')::date), (now() at time zone 'Australia/Brisbane')::date) as d_from,
           least(coalesce(p_to, (now() at time zone 'Australia/Brisbane')::date + 120), (now() at time zone 'Australia/Brisbane')::date + 400) as d_to
  )
  select * from (
    select a.date, coalesce(a.all_day, true), case when coalesce(a.all_day, true) then null else a.start_time end,
           case when coalesce(a.all_day, true) then null else a.end_time end, 'blocked'::text
    from public.availability a, bounds
    where a.creative_id = p_creative and coalesce(a.is_available, false) = false
      and a.date between bounds.d_from and bounds.d_to
    union all
    select b.booking_date, b.all_day, b.start_time, b.end_time, 'booked'::text
    from public.bookings b, bounds
    where b.creative_id = p_creative and b.status = 'confirmed' and b.booking_date is not null
      and b.booking_date between bounds.d_from and bounds.d_to
  ) x
  where public.account_is_active(p_creative)
  order by 1, 3 nulls first
  limit 300
$$;
revoke all on function public.creative_busy_times(uuid, date, date) from public;
grant execute on function public.creative_busy_times(uuid, date, date) to anon, authenticated, service_role;

-- The signed-in client's bookings, without the creative's private notes.
create or replace function public.my_client_bookings()
returns table (id uuid, creative_id uuid, client_name text, service text, booking_date date, all_day boolean,
  start_time time, end_time time, location text, status text, origin text, message text, response_note text,
  cancelled_by text, cancelled_at timestamptz, confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.creative_id, b.client_name, b.service, b.booking_date, b.all_day, b.start_time, b.end_time, b.location,
         b.status, b.origin, b.message, b.response_note, b.cancelled_by, b.cancelled_at, b.confirmed_at, b.created_at, b.updated_at
  from public.bookings b
  where auth.uid() is not null and b.client_user_id = auth.uid()
  order by b.booking_date nulls last, b.start_time nulls first
$$;
revoke all on function public.my_client_bookings() from public;
grant execute on function public.my_client_bookings() to authenticated;
