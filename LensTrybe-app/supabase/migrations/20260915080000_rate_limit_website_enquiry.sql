-- Rate limit the one anonymous function that writes.
--
-- submit_website_enquiry is callable by anon, by design: it is the enquiry form on a
-- creative's public portfolio website, and a client should not need an account to use
-- it. But it validates format and nothing else. Anyone could call it in a loop and
-- insert a thread and a message per call, against any creative id that exists, and
-- creative ids are public because they are in profile URLs.
--
-- The rows are only half of it. send-enquiry is a separate Edge Function with
-- verify_jwt false that emails the creative about a thread, so the same caller can turn
-- junk rows into junk email. Nothing on that path knew how to say no.
--
-- rate_limit_hit already exists and is already used by waitlist-signup. It was simply
-- never applied here.
--
-- Two keys, because they stop different things:
--
--   per email    five an hour. A real client sends one. This stops the simple loop.
--   per creative twenty an hour. An attacker can vary the email address, so the email
--                key alone would not hold. This one caps how much noise any single
--                creative can be buried under, which is the outcome that actually
--                matters to them.
--
-- There is no IP to key on. Inside Postgres, a PostgREST call carries no reliable
-- client address, so keying on the caller is not available here. These two keys are
-- what can be done at this layer, and they turn an unbounded problem into a bounded
-- one. Anything stronger belongs in front of the API, not in this function.
--
-- Everything else about the function is unchanged: same validation, same messages, same
-- return value.
--
-- One non-obvious thing, so nobody "fixes" it later. A PostgREST RPC is its own
-- transaction, so when this function raises, the rate_limit_hit increment that caused
-- the raise is rolled back with it. A blocked attempt therefore does not consume
-- budget, and the counter sits at the limit rather than climbing.
--
-- That is the behaviour you want. The counter stays at 5, every further attempt in the
-- window is refused, and the window still expires one hour after the fifth genuine
-- enquiry rather than being extended by the attacker's own traffic. It also means the
-- per-creative counter only ever counts enquiries that actually landed, which is the
-- number a creative would recognise.
--
-- Verified on 15 September 2026: five calls allowed, sixth refused, both counters
-- incrementing, and the test rows removed afterwards.

create or replace function public.submit_website_enquiry(
  p_creative_id uuid,
  p_name text,
  p_email text,
  p_message text,
  p_subject text default 'Enquiry from portfolio website'::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_msg text := btrim(coalesce(p_message, ''));
  v_subject text := left(coalesce(nullif(btrim(p_subject), ''), 'Enquiry from portfolio website'), 200);
  v_thread uuid;
begin
  if v_name = '' or length(v_name) > 200 then raise exception 'Please enter your name'; end if;
  if length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if v_msg = '' or length(v_msg) > 5000 then raise exception 'Message must be between 1 and 5000 characters'; end if;
  if not exists (select 1 from public.profiles where id = p_creative_id) then
    raise exception 'Creative not found';
  end if;

  -- Checked after validation so a real person fixing a typo is not punished for it, and
  -- before the inserts so nothing lands once the limit is reached.
  if not public.rate_limit_hit('enquiry:email:' || v_email, 5, 3600) then
    raise exception 'Too many enquiries from this email address. Please try again later.';
  end if;
  if not public.rate_limit_hit('enquiry:creative:' || p_creative_id::text, 20, 3600) then
    raise exception 'This creative is receiving too many enquiries right now. Please try again later.';
  end if;

  insert into public.message_threads (creative_id, client_user_id, client_name, client_email, subject, last_message_at, unread_count)
  values (p_creative_id, auth.uid(), v_name, v_email, v_subject, now(), 1)
  returning id into v_thread;

  insert into public.messages (creative_id, thread_id, sender_type, sender_name, sender_email, subject, body, read)
  values (p_creative_id, v_thread, 'client', v_name, v_email, v_subject, v_msg, false);

  return v_thread;
end $function$;

comment on function public.submit_website_enquiry(uuid, text, text, text, text) is
  'Public portfolio website enquiry form. Anonymous by design. Rate limited to 5 per hour per email address and 20 per hour per creative, because it writes rows and send-enquiry can turn those rows into email.';
