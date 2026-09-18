-- Every foreign key gets a covering index, and the three duplicate indexes go.
--
-- An unindexed foreign key makes two things slow. Any lookup by that column is a
-- sequential scan, which is most of what this app does: messages by thread, portfolio
-- items by creative, reviews by creative. And deleting a parent row has to scan the whole
-- child table to check the constraint, so deleting an account gets slower with every row
-- anyone else adds.
--
-- The advisor found 39 in public and one in ops. It now reports none.
--
-- Generated rather than typed, from pg_constraint, so it covers exactly what is there and
-- nothing that is not. Re-running is a no-op: it skips any key that has since been
-- covered, and every statement is IF NOT EXISTS.
--
-- Expect the unused_index advisory to climb after this, from 30 to 67. That is correct
-- and not a reason to undo it. Pre-launch, "unused" means no traffic has arrived yet, not
-- that the index is useless. Revisit it a month after the directory opens, when the
-- numbers mean something.
do $$
declare
  r record;
  idx text;
  n int := 0;
begin
  for r in
    with fk as (
      select c.conrelid::regclass::text as tbl, c.conname,
             (select array_agg(a.attname order by k.ord)
                from unnest(c.conkey) with ordinality k(attnum, ord)
                join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace ns on ns.oid = t.relnamespace
      where c.contype = 'f' and ns.nspname = 'public'
    )
    select fk.tbl, fk.cols from fk
    where not exists (
      select 1 from pg_index i
      where i.indrelid = fk.tbl::regclass
        and (select array_agg(a.attname order by k.ord)
               from unnest(i.indkey::smallint[]) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
              where k.ord <= array_length(fk.cols, 1)) = fk.cols
    )
  loop
    idx := left('idx_' || r.tbl || '_' || array_to_string(r.cols, '_'), 63);
    execute format('create index if not exists %I on public.%I (%s)',
                   idx, r.tbl, (select string_agg(quote_ident(c), ', ') from unnest(r.cols) c));
    n := n + 1;
  end loop;
  raise notice 'created % foreign key indexes', n;
end $$;

-- The one foreign key outside public, on the backend agent's incident log.
create index if not exists idx_incidents_run_id on ops.incidents (run_id);

-- Three pairs of identical indexes, one of each pair kept. Two indexes on the same column
-- means every insert and update maintains both for no benefit. The kept name in each pair
-- is the Postgres default shape, so a future migration that recreates it lands on the
-- same name rather than making a fourth.
drop index if exists public.idx_profiles_referral_code;
drop index if exists public.idx_referrals_referral_code;
drop index if exists public.idx_referrals_referrer_id;
