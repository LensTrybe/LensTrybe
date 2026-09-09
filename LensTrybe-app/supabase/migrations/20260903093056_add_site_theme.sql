alter table public.profiles
  add column if not exists site_theme jsonb,
  add column if not exists site_logo_url text;
