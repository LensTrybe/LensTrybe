-- Update card: creatives can replace the saved card on their subscription.
--  * card_* describe the saved card for display (brand, last four, expiry). Never the full number.
--  * card_update_order_id is the zero-amount Revolut order used to save a new card. It is kept
--    apart from revolut_last_order_id, which tracks renewal charges.
alter table public.subscriptions add column if not exists card_brand text;
alter table public.subscriptions add column if not exists card_last4 text;
alter table public.subscriptions add column if not exists card_exp_month int;
alter table public.subscriptions add column if not exists card_exp_year int;
alter table public.subscriptions add column if not exists card_update_order_id text;
alter table public.subscriptions add column if not exists card_update_started_at timestamptz;
create index if not exists subscriptions_card_update_order_idx on public.subscriptions (card_update_order_id) where card_update_order_id is not null;
