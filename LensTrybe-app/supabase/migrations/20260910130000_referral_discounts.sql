-- Referral programme: discount tracking + reward helpers.
-- first_charge_discount: set on a referred creative's subscription so their FIRST real
-- charge (end of trial) gets 10% off, once. Cleared after it is applied.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS first_charge_discount boolean NOT NULL DEFAULT false;

-- pending_referral_rewards: the referrer's queue of unredeemed 10%-off rewards.
-- Monthly consumes one per charge; annual stacks up to 5 (50% cap) onto the next renewal.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_referral_rewards integer NOT NULL DEFAULT 0;

-- Atomically credit a referrer when one of their referrals is confirmed:
-- bump the visible count and add one reward to their queue.
CREATE OR REPLACE FUNCTION public.award_referral(p_referrer uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1,
      pending_referral_rewards = COALESCE(pending_referral_rewards, 0) + 1
  WHERE id = p_referrer;
END;
$function$;

-- Consume n rewards from a referrer's queue after they have been applied to a charge
-- (never drops below zero).
CREATE OR REPLACE FUNCTION public.consume_referral_rewards(p_user uuid, p_n integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles
  SET pending_referral_rewards = GREATEST(COALESCE(pending_referral_rewards, 0) - p_n, 0)
  WHERE id = p_user;
END;
$function$;
