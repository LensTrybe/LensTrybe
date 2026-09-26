-- RUN AT THE SWAP (after lenstrybe.com is serving Next), not before: the old site reads
-- profiles and reviews with select('*') on public pages, which this would break.
--
-- Security pass (27 Sep): profiles and reviews are readable row-wide by anyone (that's how
-- public profiles work), and the SELECT grant covers every column, including private ones.
-- This swaps the table-wide grant for a column list without the private columns.
-- Next reads its own profile through my_profile() (security definer), so it keeps working.
--
-- After this, a NEW column added to profiles or reviews is NOT readable by the app until it is
-- granted: grant select (new_column) on public.profiles to anon, authenticated;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('business_email', 'phone', 'abn', 'stripe_customer_id', 'revolut_customer_id', 'calendar_token');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'reviews'
     and column_name not in ('reviewer_email');
  execute 'revoke select on public.reviews from anon, authenticated';
  execute format('grant select (%s) on public.reviews to anon, authenticated', cols);
end $$;

-- Check afterwards (both should fail with "permission denied"):
--   set role anon; select business_email from profiles limit 1; reset role;
--   set role anon; select reviewer_email from reviews limit 1; reset role;
