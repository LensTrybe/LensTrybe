-- Remove the client dashboard walkthrough data.
--
-- Placeholder rows were seeded on 20 September 2026 so the client dashboard
-- could be looked at with something in it. Every one of them has an id starting
-- dddddddd-, which is the only thing that marks them, so this is the whole set.
--
-- They belong to Michael's own two accounts and nobody else's:
--   client   db802c00-706a-4ea1-8d16-180378833c85  streamdaddyy@icloud.com
--   creative 70fbd390-8cfb-44eb-aa36-862120777cbd  Forged In Frame Media
--
-- Run this before launch, or any time the dashboard needs to be seen empty.
-- Children first, then parents, so no foreign key is left dangling.

begin;

-- Notifications the document trigger raised for these rows. They carry the
-- document's id in meta, so they are findable even though their own ids are not
-- part of the dddddddd- set.
delete from public.notifications
 where coalesce(meta->>'id', '')         like 'dddddddd-%'
    or coalesce(meta->>'booking_id', '') like 'dddddddd-%'
    or coalesce(meta->>'thread_id', '')  like 'dddddddd-%'
    or coalesce(meta->>'job_id', '')     like 'dddddddd-%';

delete from public.job_applications where id::text like 'dddddddd-%';
delete from public.job_listings     where id::text like 'dddddddd-%';
delete from public.messages         where id::text like 'dddddddd-%';
delete from public.message_threads  where id::text like 'dddddddd-%';
delete from public.shot_lists       where id::text like 'dddddddd-%';
delete from public.deliveries       where id::text like 'dddddddd-%';
delete from public.contracts        where id::text like 'dddddddd-%';
delete from public.quotes           where id::text like 'dddddddd-%';
delete from public.invoices         where id::text like 'dddddddd-%';

-- bookings_guard is a BEFORE trigger on insert and update, not delete, so a
-- plain delete needs no special role.
delete from public.bookings         where id::text like 'dddddddd-%';
delete from public.projects         where id::text like 'dddddddd-%';

-- Anything left should be zero on every line.
select 'projects' as t, count(*) from public.projects where id::text like 'dddddddd-%'
union all select 'bookings',         count(*) from public.bookings         where id::text like 'dddddddd-%'
union all select 'invoices',         count(*) from public.invoices         where id::text like 'dddddddd-%'
union all select 'quotes',           count(*) from public.quotes           where id::text like 'dddddddd-%'
union all select 'contracts',        count(*) from public.contracts        where id::text like 'dddddddd-%'
union all select 'deliveries',       count(*) from public.deliveries       where id::text like 'dddddddd-%'
union all select 'shot_lists',       count(*) from public.shot_lists       where id::text like 'dddddddd-%'
union all select 'message_threads',  count(*) from public.message_threads  where id::text like 'dddddddd-%'
union all select 'messages',         count(*) from public.messages         where id::text like 'dddddddd-%'
union all select 'job_listings',     count(*) from public.job_listings     where id::text like 'dddddddd-%'
union all select 'job_applications', count(*) from public.job_applications where id::text like 'dddddddd-%'
union all select 'notifications',    count(*) from public.notifications
  where coalesce(meta->>'id', '') like 'dddddddd-%'
     or coalesce(meta->>'booking_id', '') like 'dddddddd-%'
     or coalesce(meta->>'thread_id', '') like 'dddddddd-%'
     or coalesce(meta->>'job_id', '') like 'dddddddd-%';

commit;

-- One thing this cannot undo: if a review was posted from the prompt on the
-- completed booking, it is a real review on a real profile. Find it with
--   select * from public.reviews where lower(reviewer_email) = 'streamdaddyy@icloud.com';
-- and delete it by hand if it was only a test.
