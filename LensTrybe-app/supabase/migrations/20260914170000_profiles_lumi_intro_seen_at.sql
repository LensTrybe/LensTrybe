-- Remembers that a creative has seen the one time Lumi intro, so it follows them
-- across devices instead of living in one browser's local storage.
alter table public.profiles
  add column if not exists lumi_intro_seen_at timestamptz;

comment on column public.profiles.lumi_intro_seen_at is
  'When the creative dismissed the first run Lumi intro. Null means they have not seen it.';
