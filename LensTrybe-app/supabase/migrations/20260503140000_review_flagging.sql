-- Review dispute / flagging + soft-hide for admin resolution
alter table public.reviews add column if not exists flagged boolean not null default false;
alter table public.reviews add column if not exists flag_reason text;
alter table public.reviews add column if not exists flag_status text;
alter table public.reviews add column if not exists flagged_at timestamptz;
alter table public.reviews add column if not exists hidden boolean not null default false;

comment on column public.reviews.flag_status is 'pending | resolved_kept | resolved_removed';
