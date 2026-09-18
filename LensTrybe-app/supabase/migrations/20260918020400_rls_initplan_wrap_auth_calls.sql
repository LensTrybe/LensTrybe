-- Wrap auth.uid(), auth.jwt() and auth.role() in a subselect across every public policy.
--
-- Written as `auth.uid() = creative_id`, Postgres calls the function once per row. Written
-- as `(select auth.uid()) = creative_id` it becomes an InitPlan, evaluated once for the
-- whole query. Same result, and the difference grows with the row count. The Supabase
-- performance advisor flagged 177 policies for this; it now reports none.
--
-- It matters most on a phone. A slow query on a high latency connection is felt, where
-- the same query on a desktop on wifi is not.
--
-- ALTER POLICY rather than drop and recreate, so no policy is ever absent, not even for
-- the instant inside this transaction. Nothing is dropped, nothing is reordered, and the
-- roles and command a policy applies to are untouched.
--
-- The normalise step before the wrap matters: Postgres renders an already-wrapped call as
-- "( SELECT auth.uid() AS uid)", so without it a second run would produce
-- "(select (select auth.uid()))". Normalising first makes this safe to run again.
--
-- Verified by snapshotting pg_policies before and after, stripping the wrapper from both
-- sides and comparing: 196 policies before and after, all matched by name, zero
-- differences in USING, zero in WITH CHECK, zero in command, permissive flag or roles.
do $$
declare
  r record;
  q text;
  w text;
  stmt text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.(uid|jwt|role)\(\)'
  loop
    q := r.qual;
    w := r.with_check;

    -- normalise anything already wrapped back to the bare call
    q := replace(replace(replace(q,
          '( SELECT auth.uid() AS uid)', 'auth.uid()'),
          '( SELECT auth.jwt() AS jwt)', 'auth.jwt()'),
          '( SELECT auth.role() AS role)', 'auth.role()');
    w := replace(replace(replace(w,
          '( SELECT auth.uid() AS uid)', 'auth.uid()'),
          '( SELECT auth.jwt() AS jwt)', 'auth.jwt()'),
          '( SELECT auth.role() AS role)', 'auth.role()');

    -- then wrap, once
    q := replace(replace(replace(q,
          'auth.uid()', '(select auth.uid())'),
          'auth.jwt()', '(select auth.jwt())'),
          'auth.role()', '(select auth.role())');
    w := replace(replace(replace(w,
          'auth.uid()', '(select auth.uid())'),
          'auth.jwt()', '(select auth.jwt())'),
          'auth.role()', '(select auth.role())');

    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if w is not null then stmt := stmt || format(' with check (%s)', w); end if;

    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'rewrote % policies', n;
end $$;
