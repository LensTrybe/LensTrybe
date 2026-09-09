alter table public.waitlist add column if not exists state text;
create index if not exists waitlist_state_idx on public.waitlist (state);
