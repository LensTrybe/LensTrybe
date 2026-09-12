-- Pro gets a Lumi taster: 5 messages a month, 3 a day, sold on the Pro card rather than
-- hidden. Keeps tier_limits in step with src/lib/tierFeatures.js.
--
-- The lumi-chat function already carried pro: { monthly: 5, daily: 3 }, so the quota it
-- enforces already matches. This just makes tier_allows agree that Pro has Lumi at all.
update public.tier_limits set lumi = true where tier = 'pro';
