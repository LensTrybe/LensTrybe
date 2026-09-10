-- Group B security pass: one-time notification flags so notify-review and
-- notify-contract-signed cannot be replayed to spam creatives.
alter table public.reviews add column if not exists notified_at timestamptz;
alter table public.contracts add column if not exists signed_notified_at timestamptz;
