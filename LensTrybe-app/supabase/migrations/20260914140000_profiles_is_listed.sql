-- Find a Creative used to return every creative the moment they signed up, which meant
-- brand new accounts showed as blank cards: no photo, no tagline, no creative type. That
-- is a bad first impression for a client and an unfair one for the creative.
--
-- is_listed is the single source of truth for "this profile is ready to be found". Search
-- and the home page carousels filter on it, and the dashboard banner reads the same three
-- fields so a creative is never invisible without being told why.
--
-- It is a generated column on purpose: it can never drift from the profile it describes,
-- and it updates the moment the creative fills the gap in.

alter table public.profiles
  add column if not exists is_listed boolean
  generated always as (
    coalesce(nullif(btrim(avatar_url), ''), '') <> ''
    and coalesce(nullif(btrim(tagline), ''), '') <> ''
    and coalesce(array_length(skill_types, 1), 0) >= 1
  ) stored;

comment on column public.profiles.is_listed is
  'True when the profile has a photo, a tagline and at least one creative type. Find a Creative and the home page carousels only return rows where this is true.';

-- Partial, because every query that uses this column wants the listed rows.
create index if not exists profiles_is_listed_idx
  on public.profiles (is_listed)
  where is_listed;
