-- Stores each creative's custom dashboard widget layout:
-- ordered array of { id, size ('sm'|'md'|'lg'), hidden (bool) }.
alter table public.profiles add column if not exists dashboard_layout jsonb;
