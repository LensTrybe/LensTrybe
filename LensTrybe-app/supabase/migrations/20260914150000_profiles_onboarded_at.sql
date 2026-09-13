-- The three step setup wizard at /onboarding only ever ran for Google sign ins, because
-- that was the only path with no profile row yet. Email and password signups get their
-- profile built by the handle_new_user trigger, so they went straight to the dashboard
-- and never saw the wizard at all.
--
-- onboarded_at is the marker that lets both paths use the same wizard: it is null until
-- the creative has been through it (or explicitly skipped), and the app routes on that
-- rather than on whether a profile row happens to exist.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When the creative finished or skipped the setup wizard. Null means send them to /onboarding. Backfilled to created_at for everyone who signed up before the wizard covered email signups.';

-- Everyone who already has an account has, by definition, already got past signup.
-- Without this they would all be dragged into the wizard on their next login.
update public.profiles
   set onboarded_at = coalesce(created_at, now())
 where onboarded_at is null;
