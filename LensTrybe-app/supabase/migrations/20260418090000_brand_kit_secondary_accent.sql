-- Extra brand kit colours for documents and galleries
alter table public.brand_kit
  add column if not exists secondary_color text default '#ffffff';

alter table public.brand_kit
  add column if not exists accent_color text default '#0a0a0f';
