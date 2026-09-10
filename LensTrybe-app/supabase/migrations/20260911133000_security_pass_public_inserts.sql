-- Waitlist and creator-partner applications are only written by their (rate-limited)
-- Edge Functions with the service role, so direct public inserts are closed.
drop policy if exists "Anyone can join waitlist" on public.waitlist;
drop policy if exists "Anyone can apply" on public.creator_partner_applications;
-- Analytics rows can only be attributed to a real creative, and a signed-in viewer
-- can't record views as someone else.
drop policy if exists profile_views_insert_any on public.profile_views;
create policy profile_views_insert_any on public.profile_views for insert to anon, authenticated
  with check (creative_id is not null and (viewer_id is null or viewer_id = auth.uid()));
