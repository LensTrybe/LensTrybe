-- Revolut billing scaffold (additive; Stripe flow untouched).

-- Mirror stripe_customer_id on profiles for Revolut.
alter table public.profiles
  add column if not exists revolut_customer_id text;

-- One subscription row per user (upserted by edge functions via service role).
create table if not exists public.subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  provider                    text not null default 'revolut',
  tier                        text,                             -- pro | expert | elite
  billing                     text,                             -- monthly | annual
  status                      text not null default 'pending',  -- pending|active|past_due|canceled|trialing
  revolut_customer_id         text,
  revolut_payment_method_id   text,
  revolut_last_order_id       text,
  amount_minor                integer,                          -- charge amount in minor units
  currency                    text not null default 'AUD',
  current_period_end          timestamptz,
  next_charge_date            date,
  founding_member             boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_status_next_charge_idx
  on public.subscriptions (status, next_charge_date);

create index if not exists subscriptions_revolut_customer_idx
  on public.subscriptions (revolut_customer_id);

alter table public.subscriptions enable row level security;

-- Users may read only their own subscription. Both roles listed per policy standard;
-- anon has no auth.uid() so it resolves to no rows. Writes are done by the
-- service role (edge functions), which bypasses RLS.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to anon, authenticated
  using (auth.uid() = user_id);
