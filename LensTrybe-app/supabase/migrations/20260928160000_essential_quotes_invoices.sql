-- Trybe Essential (pro) gets quotes and invoices (28 Sep). Contracts, client portals and the brand
-- kit stay on Trybe Complete and above. guard_tier_feature reads these flags on insert.
-- Clients answer an Essential quote from its own emailed link (/doc/quote/<view_token>), through
-- respond-quote's view_token path, since Essential has no client portal.
update public.tier_limits set quotes = true, invoicing = true where tier = 'pro';
