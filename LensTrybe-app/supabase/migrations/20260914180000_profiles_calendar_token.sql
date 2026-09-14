-- One way calendar sync. The creative pastes a private feed URL into Google, Apple or
-- Outlook once, and their LensTrybe bookings, meetings and blocked out days appear in the
-- calendar they already live in.
--
-- The token is the only thing guarding the feed, which is how every calendar subscription
-- works (Google calls it a secret address), so it has to be unguessable and revocable.

alter table public.profiles
  add column if not exists calendar_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_calendar_token_idx
  on public.profiles (calendar_token);

comment on column public.profiles.calendar_token is
  'Secret token in the creative''s private calendar feed URL. Rotating it kills every old subscription.';

-- Rotating the token is how a creative revokes a feed they shared by accident, so it must
-- always produce a fresh random value. Going through a function rather than a direct update
-- means the client cannot set it to something it already knows.
create or replace function public.reset_calendar_token()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.profiles
     set calendar_token = gen_random_uuid()
   where id = auth.uid()
  returning calendar_token into v_token;

  if v_token is null then
    raise exception 'No profile for this account';
  end if;

  return v_token;
end $$;

revoke all on function public.reset_calendar_token() from public;
grant execute on function public.reset_calendar_token() to authenticated;
