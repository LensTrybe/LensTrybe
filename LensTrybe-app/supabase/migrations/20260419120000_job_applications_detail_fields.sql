-- Rich job application fields (modal submit)
alter table public.job_applications
  add column if not exists creative_name text;

alter table public.job_applications
  add column if not exists price numeric;

alter table public.job_applications
  add column if not exists description text;

alter table public.job_applications
  add column if not exists includes text;

-- Legacy `message` remains for older rows; new inserts use description + message mirror in app
alter table public.job_applications
  alter column message drop not null;
