-- Lets a health run see which scheduled jobs are actually scheduled.
--
-- A cron job that silently stops is indistinguishable from a quiet day: no error, no
-- alert, just nothing happening. revolut-charge-due going missing would mean nobody is
-- charged, and the first sign would be a creative asking why they still have not paid.
--
-- cron.job is not reachable through PostgREST, so this is the door. It returns job names
-- and schedules only.
--
-- It deliberately does NOT return cron.job.command. That column holds the full
-- net.http_post call for each job, including the CRON_SECRET in the headers. Selecting
-- it would hand the secret to anything that can call this function, which is the whole
-- reason the columns are listed out one by one instead of using a row type.

create or replace function public.ops_active_cron_jobs()
returns table (jobname text, schedule text, active boolean)
language sql
stable
security definer
set search_path to 'cron', 'pg_catalog'
as $$
  select j.jobname::text, j.schedule::text, j.active
  from cron.job j
  where j.active
$$;

revoke all on function public.ops_active_cron_jobs() from public;
revoke all on function public.ops_active_cron_jobs() from anon, authenticated;
grant execute on function public.ops_active_cron_jobs() to service_role;

comment on function public.ops_active_cron_jobs() is
  'Active scheduled jobs, names and schedules only. Never returns cron.job.command, which contains CRON_SECRET. Service role only, for config-check.';
