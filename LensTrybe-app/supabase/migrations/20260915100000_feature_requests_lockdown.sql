-- Close the second anonymous write path, and make the requests readable by someone who
-- actually exists.
--
-- Two separate problems on the same table, both found on 15 September 2026.
--
-- 1. The Upcoming Features page inserted straight into feature_requests from the
--    browser. The policy was `for insert to anon, authenticated with check (true)`, so
--    there was no validation of any kind and no ceiling. Any caller could write rows of
--    unbounded length, as many as they liked. This is the same hole that was closed on
--    submit_website_enquiry, missed the first time because that audit looked at
--    anon-callable FUNCTIONS and this one is a direct table insert.
--
-- 2. The only select policy granted read to an account whose email is
--    connect@lenstrybe.com. No such user exists in auth.users, and nothing in the app
--    reads the table. Every feature request submitted since the page went up has been
--    written to a table that nobody could open. The table is empty today, so nothing has
--    been lost, but the form was decorative.
--
-- The fix follows the pattern already used for waitlist-signup and
-- submit_website_enquiry: the page calls a security definer function that validates,
-- rate limits and then inserts, and anon loses the ability to touch the table directly.
--
-- Rate limits, and why these numbers:
--
--   per email    three an hour. Someone with three separate ideas in an hour is rare and
--                is not who this is defending against.
--   global       sixty an hour. A backstop, because the email key alone falls over the
--                moment a caller varies the address. Sixty genuine feature requests in
--                one hour would be a remarkable day, so this only ever bites a flood.
--
-- As with submit_website_enquiry, a raise rolls back the rate_limit_hit increment that
-- triggered it, because a PostgREST call is one transaction. That is intended: a blocked
-- attempt does not consume budget, so the counter sits at the limit instead of climbing,
-- and the window is not extended by an attacker's own traffic. Do not "fix" it.

-- Length caps at the column level, so nothing can get long even if a future caller finds
-- another way in. The values are generous for real use.
alter table public.feature_requests
  drop constraint if exists feature_requests_lengths;

alter table public.feature_requests
  add constraint feature_requests_lengths check (
    length(business_name) between 1 and 200
    and length(email) between 3 and 320
    and length(skill) between 1 and 100
    and length(feature_request) between 1 and 3000
  );

create or replace function public.submit_feature_request(
  p_business_name text,
  p_email text,
  p_skill text,
  p_feature_request text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_business_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_skill text := btrim(coalesce(p_skill, ''));
  v_request text := btrim(coalesce(p_feature_request, ''));
begin
  if v_name = '' or length(v_name) > 200 then
    raise exception 'Please enter your business name';
  end if;
  if length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if v_skill = '' or length(v_skill) > 100 then
    raise exception 'Please select your skill';
  end if;
  if v_request = '' or length(v_request) > 3000 then
    raise exception 'Your request must be between 1 and 3000 characters';
  end if;

  -- After validation, so a real person fixing a typo is not punished for it.
  if not public.rate_limit_hit('feature:email:' || v_email, 3, 3600) then
    raise exception 'You have sent a few requests already. Please try again later.';
  end if;
  if not public.rate_limit_hit('feature:global', 60, 3600) then
    raise exception 'We are receiving a lot of requests right now. Please try again later.';
  end if;

  insert into public.feature_requests (business_name, email, skill, feature_request)
  values (v_name, v_email, v_skill, v_request);
end $function$;

revoke all on function public.submit_feature_request(text, text, text, text) from public;
grant execute on function public.submit_feature_request(text, text, text, text) to anon, authenticated;

comment on function public.submit_feature_request(text, text, text, text) is
  'Public feature request form on /upcoming-features. Anonymous by design. Rate limited to 3 per hour per email address and 60 per hour overall. The only write path into feature_requests, because anon has no direct insert.';

-- Anon no longer writes to the table directly. The function above is the only door.
drop policy if exists "Allow public inserts to feature_requests" on public.feature_requests;

-- And the requests become readable by staff, rather than by an account that was never
-- created. is_staff() already backs every other admin read in the project.
drop policy if exists "Allow admin to read feature_requests" on public.feature_requests;

create policy "Staff read feature requests"
  on public.feature_requests
  for select
  to authenticated
  using (public.is_staff());
