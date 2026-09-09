alter table public.profiles
  add column if not exists site_primary_color text,
  add column if not exists site_background_color text,
  add column if not exists site_heading_font text,
  add column if not exists site_body_font text;
