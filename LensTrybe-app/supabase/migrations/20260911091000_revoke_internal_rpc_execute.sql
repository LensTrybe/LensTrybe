-- Server-only functions were callable by anyone through /rest/v1/rpc/*.
-- award_referral / consume_referral_rewards / increment_referral_count move money
-- (referral discounts) and are only ever called by Edge Functions with the service
-- role. The rest are trigger or utility functions that should never be RPCs.
-- (Trigger functions still fire; EXECUTE is only checked when a trigger is created.)
revoke execute on function public.award_referral(uuid) from public, anon, authenticated;
revoke execute on function public.consume_referral_rewards(uuid, integer) from public, anon, authenticated;
revoke execute on function public.increment_referral_count(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.enforce_creative_message_monthly_limit() from public, anon, authenticated;
grant execute on function public.award_referral(uuid) to service_role;
grant execute on function public.consume_referral_rewards(uuid, integer) to service_role;
grant execute on function public.increment_referral_count(uuid) to service_role;
