-- Denormalised poster contact on listings (set when posting) for application emails
alter table public.job_listings
  add column if not exists poster_email text;

alter table public.job_listings
  add column if not exists poster_name text;

-- Job owners can read applications submitted to their listings
create policy "Job posters see applications to own listings"
  on public.job_applications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.job_listings jl
      where jl.id = job_applications.job_id
        and jl.posted_by = auth.uid()
    )
  );
