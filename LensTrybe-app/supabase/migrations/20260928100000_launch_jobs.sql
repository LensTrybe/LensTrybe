-- Client-first launch (Michael, 28 Sep).
--  * site_settings: small public switches the site reads at load, so they change without a deploy.
--      home_hero        'job' (post a job is the home page) or 'ask' (the find-a-creative ask).
--      jobs_open_until  until this time every plan, Basic included, can reply to any job anywhere.
--                       After it passes, the normal plan rules come back on their own.
--  * jobs_posted_recent(): how many jobs clients posted in the last N days, for the creative-facing
--    proof line. A count only; no job details.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Site settings are public" on public.site_settings;
create policy "Site settings are public" on public.site_settings for select to anon, authenticated using (true);
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

insert into public.site_settings (key, value) values
  ('home_hero', '"job"'::jsonb),
  ('jobs_open_until', '"2027-01-01T00:00:00+10:00"'::jsonb)
on conflict (key) do nothing;

create or replace function public.jobs_open_to_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select now() < (value #>> '{}')::timestamptz from public.site_settings where key = 'jobs_open_until'), false)
$$;

create or replace function public.jobs_posted_recent(p_days int default 30) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.job_listings
  where created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
$$;
revoke all on function public.jobs_posted_recent(int) from public;
grant execute on function public.jobs_posted_recent(int) to anon, authenticated;
revoke all on function public.jobs_open_to_all() from public;
grant execute on function public.jobs_open_to_all() to anon, authenticated;

-- The reply guard, with the plan checks skipped while the launch window is open.
create or replace function public.guard_job_application() returns trigger
language plpgsql set search_path = public as $$
declare v_status text; v_exp timestamptz; v_poster uuid; v_loc text; v_tier text; v_state text; v_name text; v_js text; v_ok boolean;
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if TG_OP = 'INSERT' then
    if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
    NEW.id := gen_random_uuid();
    NEW.creative_id := auth.uid();
    NEW.status := 'pending';
    NEW.created_at := now();
    -- named columns: browser users can't read poster_email
    select status, expires_at, posted_by, location into v_status, v_exp, v_poster, v_loc from public.job_listings where id = NEW.job_id;
    if not found or v_status <> 'active' or v_exp < now() then raise exception 'This job isn''t open any more.' using errcode = 'P0001'; end if;
    if v_poster = NEW.creative_id then raise exception 'You can''t reply to your own job.' using errcode = 'P0001'; end if;
    select lower(coalesce(subscription_tier, 'basic')), upper(btrim(coalesce(state, ''))), business_name into v_tier, v_state, v_name from public.profiles where id = NEW.creative_id;
    if not public.jobs_open_to_all() then
      if v_tier is null or v_tier in ('basic', '') then raise exception 'Replying to jobs is on Pro and above.' using errcode = 'P0001'; end if;
      v_js := public.job_state_of(v_loc);
      if v_tier = 'pro' and v_js is not null and v_state <> '' and v_state <> v_js then
        raise exception 'On Pro you can reply to jobs in your own state. Expert and Elite reply anywhere.' using errcode = 'P0001';
      end if;
    end if;
    v_ok := public.job_rate_ok('apply');
    if v_ok is false then raise exception 'Too many replies in a short time. Try again in a while.' using errcode = 'P0001'; end if;
    NEW.creative_name := left(coalesce(nullif(btrim(v_name), ''), nullif(btrim(NEW.creative_name), ''), 'A creative'), 120);
    NEW.description := left(NEW.description, 3000); NEW.message := left(NEW.message, 3000); NEW.includes := left(NEW.includes, 1000);
    if NEW.price is null or NEW.price < 0 or NEW.price > 1000000 then raise exception 'Add your price.' using errcode = 'P0001'; end if;
    return NEW;
  end if;
  NEW.id := OLD.id; NEW.job_id := OLD.job_id; NEW.creative_id := OLD.creative_id; NEW.created_at := OLD.created_at;
  -- the only change a creative can make to the status is withdrawing a pending reply
  if NEW.status is distinct from OLD.status and not (OLD.status = 'pending' and NEW.status = 'withdrawn') then NEW.status := OLD.status; end if;
  if OLD.status <> 'pending' then
    NEW.price := OLD.price; NEW.includes := OLD.includes; NEW.description := OLD.description; NEW.message := OLD.message; NEW.creative_name := OLD.creative_name;
  end if;
  return NEW;
end $$;
