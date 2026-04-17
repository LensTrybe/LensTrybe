-- Application workflow: pending → accepted | declined; other applicants closed when one is accepted
alter table public.job_applications
  add column if not exists status text;

update public.job_applications
  set status = 'pending'
  where status is null;

alter table public.job_applications
  alter column status set default 'pending';

alter table public.job_applications
  alter column status set not null;

alter table public.job_applications
  drop constraint if exists job_applications_status_check;

alter table public.job_applications
  add constraint job_applications_status_check
  check (status in ('pending', 'accepted', 'declined', 'closed'));

drop policy if exists "Job posters update applications on own listings" on public.job_applications;

create policy "Job posters update applications on own listings"
  on public.job_applications
  for update
  to authenticated
  using (
    exists (
      select 1 from public.job_listings jl
      where jl.id = job_applications.job_id
        and jl.posted_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.job_listings jl
      where jl.id = job_applications.job_id
        and jl.posted_by = auth.uid()
    )
  );
