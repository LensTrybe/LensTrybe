-- Billing reminders, newsletter consent + unsubscribe, light-touch founding feedback nudges.

-- 1. Remember which charge date a reminder email was sent for (one reminder per charge).
alter table public.subscriptions add column if not exists reminder_sent_for date;

-- 2. Founding feedback is a friendly nudge, not a deal condition.
alter table public.profiles add column if not exists founding_feedback_nudged_at timestamptz;

-- 3. Marketing email consent (The Trybe Edit + LensTrybe news). Service role only.
create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users (id) on delete cascade,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists email_subscribers_email_key on public.email_subscribers (lower(email));
create unique index if not exists email_subscribers_token_key on public.email_subscribers (token);
create index if not exists email_subscribers_user_idx on public.email_subscribers (user_id);
alter table public.email_subscribers enable row level security;
revoke all on public.email_subscribers from anon, authenticated;

-- Consent ticked at sign-up arrives as user metadata marketing_opt_in = true.
create or replace function public.capture_marketing_consent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', '') = 'true' and new.email is not null then
    insert into public.email_subscribers (email, user_id, status, source, consented_at)
    values (lower(new.email), new.id, 'subscribed', 'signup', now())
    on conflict ((lower(email))) do update
      set user_id = excluded.user_id, status = 'subscribed', source = 'signup',
          consented_at = now(), unsubscribed_at = null, updated_at = now();
  end if;
  return new;
exception when others then
  raise warning 'capture_marketing_consent failed for %: %', new.id, sqlerrm;
  return new;
end $$;
revoke all on function public.capture_marketing_consent() from public, anon, authenticated;

drop trigger if exists z_capture_marketing_consent on auth.users;
create trigger z_capture_marketing_consent
  after insert on auth.users
  for each row execute function public.capture_marketing_consent();
