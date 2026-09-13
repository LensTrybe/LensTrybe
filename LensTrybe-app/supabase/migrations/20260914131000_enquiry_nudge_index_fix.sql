-- Applied live after the previous migration, once enquiry-nudges was written and it turned
-- out the clock runs from last_message_at rather than created_at. The previous migration
-- file has been corrected to create the index on the right column, so a fresh replay lands
-- in the same place, and this file keeps the applied history honest.

drop index if exists public.message_threads_reply_nudge_idx;

create index if not exists message_threads_reply_nudge_idx
  on public.message_threads (last_message_at)
  where reply_nudged_at is null;
