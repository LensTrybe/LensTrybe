-- First-run dashboard walkthrough: remember when a creative finished or skipped it.
alter table public.profiles add column if not exists dashboard_tour_done_at timestamptz;
