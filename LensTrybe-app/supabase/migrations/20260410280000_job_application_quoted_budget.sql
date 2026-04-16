-- Optional quote/budget the creative submits with their application (shown with $ in UI).
alter table job_applications
  add column if not exists quoted_budget text;

-- Allow applicants to read job rows they applied to (e.g. expired listings still visible on "My jobs").
create policy "Applicants can view jobs they applied to"
  on job_listings for select
  to authenticated
  using (
    exists (
      select 1 from job_applications ja
      where ja.job_id = job_listings.id
        and ja.creative_id = auth.uid()
    )
  );
