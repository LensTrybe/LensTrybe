-- Tighten what the new tier functions expose.
--
-- Postgres grants EXECUTE to PUBLIC by default, so the tier helpers and the trigger
-- functions from the tier_limits migration ended up callable over the REST API by anyone,
-- signed in or not. Two of them actually leak: tier_of / tier_cap / tier_allows answer for
-- any user id, and delivery_bytes_used would tell an anonymous caller how much storage any
-- creative is using. The trigger functions cannot do anything useful when called directly,
-- but they have no business being in the API surface either.
--
-- Triggers run as their definer, not as the caller, so revoking EXECUTE does not stop the
-- guards firing. Checked live: a Pro insert into quotes still raises TIER_REQUIRED and a
-- second video still raises TIER_LIMIT.

-- Trigger functions: never callable directly.
revoke all on function public.guard_tier_feature() from public, anon, authenticated;
revoke all on function public.guard_tier_count() from public, anon, authenticated;
revoke all on function public.guard_crm_records() from public, anon, authenticated;
revoke all on function public.guard_deliver_storage() from public, anon, authenticated;
revoke all on function public.bookings_guard() from public, anon, authenticated;
revoke all on function public.founding_deal_end_on_cancel() from public, anon, authenticated;
revoke all on function public.founding_invites_cap_guard() from public, anon, authenticated;

-- Storage usage is the creative's own business.
revoke all on function public.delivery_bytes_used(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delivery_bytes_used(uuid, uuid) to service_role;

-- The tier helpers answer for any user id, so keep them off the anonymous API. The app
-- reads its own plan through SubscriptionContext, not through these.
revoke all on function public.tier_of(uuid) from public, anon;
revoke all on function public.tier_cap(uuid, text) from public, anon;
revoke all on function public.tier_allows(uuid, text) from public, anon;
grant execute on function public.tier_of(uuid) to authenticated, service_role;
grant execute on function public.tier_cap(uuid, text) to authenticated, service_role;
grant execute on function public.tier_allows(uuid, text) to authenticated, service_role;

-- Left over from the founding invites work: pin the search path like every other function.
create or replace function public.founding_cap()
returns int language sql immutable security definer set search_path = public as $$
  select 100
$$;
