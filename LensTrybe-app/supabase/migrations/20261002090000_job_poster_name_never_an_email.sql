-- The job poster name is public on the job board. An email address typed into it is replaced
-- with "A LensTrybe client" on insert and update (2 Oct 2026). poster_email itself has no
-- SELECT grant for anon or authenticated, so it never reaches the page.
create or replace function public.guard_job_listing()
 returns trigger
 language plpgsql
as $function$
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
    if NEW.poster_name like '%@%' then NEW.poster_name := 'A LensTrybe client'; end if;
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
  if NEW.status is distinct from OLD.status and not (OLD.status = 'active' and NEW.status = 'closed') then NEW.status := OLD.status; end if;
  if OLD.status <> 'active' then
    NEW.title := OLD.title; NEW.description := OLD.description; NEW.location := OLD.location; NEW.job_date := OLD.job_date;
    NEW.budget_range := OLD.budget_range; NEW.creative_types := OLD.creative_types; NEW.specialty := OLD.specialty; NEW.poster_name := OLD.poster_name;
  end if;
  if NEW.poster_name like '%@%' then NEW.poster_name := 'A LensTrybe client'; end if;
  return NEW;
end
$function$;
