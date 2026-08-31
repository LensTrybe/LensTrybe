alter table public.calendar_events
  add column if not exists end_time time,
  add column if not exists location text,
  add column if not exists invitees text[];
