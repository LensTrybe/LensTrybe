-- The one foreign key outside public, on the backend agent's incident log, and the
-- clean-up of the snapshot table used to prove the policy rewrite changed no logic.
--
-- A table sitting in public with no RLS and no primary key is exactly the sort of thing
-- that should not be left behind once it has served its purpose.
-- The one foreign key outside public, on the backend agent's incident log.
create index if not exists idx_incidents_run_id on ops.incidents (run_id);

drop table if exists public._rls_snapshot_20260918;
