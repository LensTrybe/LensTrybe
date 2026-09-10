-- Scheduled downgrades: a plan downgrade takes effect at the end of the current
-- paid period. revolut-charge-due reads these at renewal, charges the new lower
-- price, steps the tier down, then clears them.
alter table public.subscriptions
  add column if not exists pending_tier text,
  add column if not exists pending_billing text,
  add column if not exists pending_change_at timestamptz;

comment on column public.subscriptions.pending_tier is 'Scheduled downgrade target tier, applied by revolut-charge-due at current_period_end';
comment on column public.subscriptions.pending_billing is 'Scheduled downgrade target billing cycle';
comment on column public.subscriptions.pending_change_at is 'When the scheduled downgrade takes effect (current_period_end at time of request)';
