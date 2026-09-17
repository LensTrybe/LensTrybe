-- The unique index was on lower(email), an expression. PostgREST's upsert sends
-- "on conflict (email)", and Postgres will only match that against a unique index on the
-- bare column, so every submission failed with 42P10 and the form returned a 500.
--
-- The submit function already lowercases before writing, so the index can be on the column
-- itself. The check constraint turns that from an assumption into something the database
-- enforces, which keeps a plain unique index correct for any future writer.

alter table public.founding_applications
  add constraint founding_applications_email_lower_check
  check (email = lower(email));

drop index if exists public.founding_applications_email_key;

create unique index if not exists founding_applications_email_key
  on public.founding_applications (email);
