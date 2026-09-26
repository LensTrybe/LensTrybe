-- A creative keeps seeing the jobs they replied to after those jobs are filled or taken down.
-- Through a security-definer helper so the job_listings and job_applications policies don't recurse.
create or replace function public.replied_to_job(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_applications a where a.job_id = p_job and a.creative_id = auth.uid())
$$;
revoke all on function public.replied_to_job(uuid) from public, anon;
grant execute on function public.replied_to_job(uuid) to authenticated;

drop policy if exists "Applicants can view jobs they replied to" on public.job_listings;
create policy "Applicants can view jobs they replied to" on public.job_listings
  for select to authenticated using (public.replied_to_job(id));
