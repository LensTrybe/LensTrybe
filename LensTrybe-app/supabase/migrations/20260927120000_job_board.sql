-- Job board (LensTrybe Next). Server-side rules for job_listings and job_applications:
--  * posting: posted_by, status, dates and poster_email are set here, never by the browser; 10 a day
--  * replying: only to open jobs, not your own; Basic can't reply, Pro only in its own state;
--    status always starts 'pending'; 30 replies an hour
--  * a creative can withdraw a pending reply; nobody can set accepted / declined / closed from the
--    browser. The poster does that through accept_job_application / decline_job_application, which
--    also fill the job, close the other replies, open a thread and a client portal, and add a CRM lead.

alter table public.job_listings drop constraint if exists job_listings_status_check;
alter table public.job_listings add constraint job_listings_status_check check (status in ('active', 'filled', 'closed'));

update public.job_applications set status = 'pending' where status is null;
alter table public.job_applications alter column status set default 'pending';
alter table public.job_applications alter column status set not null;
alter table public.job_applications drop constraint if exists job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check check (status in ('pending', 'accepted', 'declined', 'closed', 'withdrawn'));

create or replace function public.job_state_of(p_location text) returns text
language sql immutable set search_path = public as $$
  select substring(upper(coalesce(p_location, '')) from '\m(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\M')
$$;

-- Rate limits for the guards below. rate_limit_hit itself is service-role only; this wrapper only ever
-- counts against the caller's own key with fixed limits.
create or replace function public.job_rate_ok(p_kind text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if p_kind = 'post' then return coalesce(public.rate_limit_hit('job-post:user:' || auth.uid(), 10, 86400), false); end if;
  if p_kind = 'apply' then return coalesce(public.rate_limit_hit('job-apply:user:' || auth.uid(), 30, 3600), false); end if;
  return true;
end $$;
revoke all on function public.job_rate_ok(text) from public, anon;
grant execute on function public.job_rate_ok(text) to authenticated;

-- The two guards run as the caller (not security definer), so current_user tells browser writes apart
-- from the service role and the security-definer functions below.
create or replace function public.guard_job_listing() returns trigger
language plpgsql set search_path = public as $$
declare v_ok boolean;
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if TG_OP = 'INSERT' then
    if auth.uid() is null then raise exception 'Please log in to post a job.' using errcode = '42501'; end if;
    v_ok := public.job_rate_ok('post');
    if v_ok is false then raise exception 'You''ve posted a lot of jobs today. Try again tomorrow.' using errcode = 'P0001'; end if;
    NEW.id := gen_random_uuid();
    NEW.posted_by := auth.uid();
    NEW.status := 'active';
    NEW.created_at := now();
    NEW.expires_at := now() + interval '30 days';
    NEW.poster_email := left(auth.jwt() ->> 'email', 254);
    NEW.poster_name := left(coalesce(nullif(btrim(NEW.poster_name), ''), 'A LensTrybe client'), 120);
    NEW.title := left(btrim(NEW.title), 150);
    NEW.description := left(btrim(NEW.description), 5000);
    NEW.location := left(btrim(coalesce(NEW.location, '')), 150);
    NEW.budget_range := left(NEW.budget_range, 60);
    NEW.specialty := left(NEW.specialty, 60);
    if NEW.title = '' or NEW.description = '' then raise exception 'Give the job a title and a few lines about it.' using errcode = 'P0001'; end if;
    return NEW;
  end if;
  NEW.id := OLD.id; NEW.posted_by := OLD.posted_by; NEW.created_at := OLD.created_at;
  NEW.expires_at := OLD.expires_at; NEW.poster_email := OLD.poster_email;
  -- the poster can only take an open job down; filling happens in accept_job_application
  if NEW.status is distinct from OLD.status and not (OLD.status = 'active' and NEW.status = 'closed') then NEW.status := OLD.status; end if;
  if OLD.status <> 'active' then
    NEW.title := OLD.title; NEW.description := OLD.description; NEW.location := OLD.location; NEW.job_date := OLD.job_date;
    NEW.budget_range := OLD.budget_range; NEW.creative_types := OLD.creative_types; NEW.specialty := OLD.specialty; NEW.poster_name := OLD.poster_name;
  end if;
  return NEW;
end $$;

drop trigger if exists a_guard_job_listing on public.job_listings;
create trigger a_guard_job_listing before insert or update on public.job_listings
  for each row execute function public.guard_job_listing();

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
    if v_tier is null or v_tier in ('basic', '') then raise exception 'Replying to jobs is on Pro and above.' using errcode = 'P0001'; end if;
    v_js := public.job_state_of(v_loc);
    if v_tier = 'pro' and v_js is not null and v_state <> '' and v_state <> v_js then
      raise exception 'On Pro you can reply to jobs in your own state. Expert and Elite reply anywhere.' using errcode = 'P0001';
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

drop trigger if exists a_guard_job_application on public.job_applications;
create trigger a_guard_job_application before insert or update on public.job_applications
  for each row execute function public.guard_job_application();

-- The poster's bell also hears about an accepted quote (the creative gets an email from job-outcome-notify).
create or replace function public.notify_creative_of_application_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_state text := lower(coalesce(NEW.status, '')); v_title text; v_job text;
begin
  if v_state not in ('declined', 'closed', 'accepted') then return NEW; end if;
  if lower(coalesce(OLD.status, '')) = v_state then return NEW; end if;
  if NEW.creative_id is null then return NEW; end if;
  select coalesce(nullif(btrim(j.title), ''), 'a job') into v_job from public.job_listings j where j.id = NEW.job_id;
  v_title := case v_state when 'declined' then 'Your application was not successful'
                          when 'accepted' then 'Your quote was accepted'
                          else 'That job has been filled' end;
  begin
    insert into public.notifications (user_id, type, title, body, link, meta)
    values (NEW.creative_id, 'job', v_title, 'For ' || coalesce(v_job, 'a job'), '/dashboard/my-work/jobs',
            jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id));
  exception when others then null;
  end;
  return NEW;
end $$;

create or replace function public.accept_job_application(p_application uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_app public.job_applications; v_job public.job_listings;
  v_email text; v_name text; v_first text; v_last text; v_thread uuid; v_msg uuid; v_portal text; v_body text;
begin
  if v_uid is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  select * into v_app from public.job_applications where id = p_application for update;
  if not found then raise exception 'That quote isn''t here any more.' using errcode = 'P0001'; end if;
  select * into v_job from public.job_listings where id = v_app.job_id for update;
  if v_job.posted_by is distinct from v_uid then raise exception 'That quote isn''t for your job.' using errcode = '42501'; end if;
  if v_job.status <> 'active' then raise exception 'This job isn''t open any more.' using errcode = 'P0001'; end if;
  if v_app.status <> 'pending' then raise exception 'That quote can''t be accepted any more.' using errcode = 'P0001'; end if;

  update public.job_applications set status = 'accepted' where id = v_app.id;
  update public.job_applications set status = 'closed' where job_id = v_job.id and id <> v_app.id and status = 'pending';
  update public.job_listings set status = 'filled' where id = v_job.id;

  select u.email into v_email from auth.users u where u.id = v_uid;
  select ca.first_name, ca.last_name into v_first, v_last from public.client_accounts ca where ca.id = v_uid;
  v_name := nullif(btrim(concat_ws(' ', v_first, v_last)), '');
  if v_name is null then select nullif(btrim(p.business_name), '') into v_name from public.profiles p where p.id = v_uid; end if;
  v_name := left(coalesce(v_name, nullif(btrim(v_job.poster_name), ''), split_part(v_email, '@', 1)), 120);

  v_body := format('Hi %s, I''d like to go ahead with your quote for "%s" (AUD %s). Looking forward to working with you!',
                   coalesce(nullif(btrim(v_app.creative_name), ''), 'there'), v_job.title, to_char(coalesce(v_app.price, 0), 'FM999,999,990.00'));
  insert into public.message_threads (creative_id, client_user_id, client_name, client_email, subject, sender_type, unread_count, last_message_at)
    values (v_app.creative_id, v_uid, v_name, v_email, left('Job: ' || v_job.title, 150), 'client', 0, now())  -- message_threads_bump adds the 1
    returning id into v_thread;
  insert into public.messages (thread_id, sender_type, sender_name, sender_email, body)
    values (v_thread, 'client', v_name, v_email, v_body) returning id into v_msg;

  select cp.portal_token::text into v_portal from public.client_portals cp
    where cp.creative_id = v_app.creative_id and lower(btrim(cp.client_email)) = lower(btrim(v_email)) limit 1;
  if v_portal is null then
    insert into public.client_portals (creative_id, client_name, client_email) values (v_app.creative_id, v_name, v_email)
      returning portal_token::text into v_portal;
  end if;

  begin
    if not exists (select 1 from public.crm_contacts c where c.creative_id = v_app.creative_id and lower(btrim(c.email)) = lower(btrim(v_email))) then
      insert into public.crm_contacts (creative_id, name, email, status, tags, notes, last_contacted_at)
        values (v_app.creative_id, v_name, v_email, 'Lead', array['Job board'], 'Accepted your quote for "' || v_job.title || '"', now());
    end if;
  exception when others then null;
  end;

  return jsonb_build_object('thread_id', v_thread, 'message_id', v_msg, 'job_id', v_job.id, 'portal_token', v_portal);
end $$;

create or replace function public.decline_job_application(p_application uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_app public.job_applications; v_job public.job_listings;
begin
  if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  select * into v_app from public.job_applications where id = p_application for update;
  if not found then raise exception 'That quote isn''t here any more.' using errcode = 'P0001'; end if;
  select * into v_job from public.job_listings where id = v_app.job_id;
  if v_job.posted_by is distinct from auth.uid() then raise exception 'That quote isn''t for your job.' using errcode = '42501'; end if;
  if v_app.status <> 'pending' then return; end if;
  update public.job_applications set status = 'declined' where id = v_app.id;
end $$;

revoke all on function public.accept_job_application(uuid) from public, anon;
revoke all on function public.decline_job_application(uuid) from public, anon;
grant execute on function public.accept_job_application(uuid) to authenticated;
grant execute on function public.decline_job_application(uuid) to authenticated;
