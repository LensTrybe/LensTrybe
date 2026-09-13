-- Reply usage as one source of truth, plus the guard column for the 24 hour enquiry nudge.
--
-- Two things were wrong before this.
--
-- 1. get_my_creative_message_reply_usage() returned a plain integer, but the front end
--    (src/lib/messageMonthlyLimit.js) reads used, max_allowed and unlimited off the result.
--    Reading those off a number gives undefined, so the dashboard counter always said the
--    creative had every reply left, the reply box never blocked, and the first thing a
--    capped creative saw was a raw trigger error on send. This returns the row the UI has
--    always expected.
-- 2. Edge Functions run as service_role and had no way to check usage for a given creative.
--    creative_reply_usage(uuid) is that entry point, and the signed in wrapper now calls it,
--    so the two can never drift apart.

alter table public.message_threads
  add column if not exists reply_nudged_at timestamptz;

comment on column public.message_threads.reply_nudged_at is
  'Set when enquiry-nudges has emailed the creative about this unanswered thread. Stops repeats.';

-- Only scans threads that have not been nudged, so a partial index stays small.
-- Keyed on last_message_at because enquiry-nudges runs its clock from the client's most
-- recent message, not from when the thread was opened.
create index if not exists message_threads_reply_nudge_idx
  on public.message_threads (last_message_at)
  where reply_nudged_at is null;

-- The one place reply usage is worked out. It owns no logic of its own: counting stays in
-- count_creative_replies_this_utc_month and the cap stays in tier_cap, which reads
-- tier_limits. Change a cap in tier_limits and this follows without an edit.
--
-- Joining profiles matters. An unknown creative returns no rows rather than quietly
-- falling back to the Basic cap, so a caller can tell "not capped" from "not found".
create or replace function public.creative_reply_usage(p_creative uuid)
returns table (used integer, max_allowed integer, unlimited boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    public.count_creative_replies_this_utc_month(p.id)::integer,
    coalesce(public.tier_cap(p.id, 'replies_per_month'), 0)::integer,
    public.tier_cap(p.id, 'replies_per_month') is null
  from public.profiles p
  where p.id = p_creative;
$function$;

comment on function public.creative_reply_usage(uuid) is
  'Monthly reply usage and cap for one creative. Service role only: Edge Functions use this.';

-- Never reachable from the browser. Same lockdown as count_creative_replies_this_utc_month.
revoke all on function public.creative_reply_usage(uuid) from public, anon, authenticated;
grant execute on function public.creative_reply_usage(uuid) to service_role;

-- The signed in wrapper. Return type changes from integer to a row, which is what the UI
-- already reads, so this fixes the counter rather than breaking it.
drop function if exists public.get_my_creative_message_reply_usage();

create function public.get_my_creative_message_reply_usage()
returns table (used integer, max_allowed integer, unlimited boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select u.used, u.max_allowed, u.unlimited
  from public.creative_reply_usage(auth.uid()) u;
$function$;

comment on function public.get_my_creative_message_reply_usage() is
  'This creative''s own monthly reply usage. Thin wrapper over creative_reply_usage(auth.uid()).';

revoke all on function public.get_my_creative_message_reply_usage() from public, anon;
grant execute on function public.get_my_creative_message_reply_usage() to authenticated, service_role;
