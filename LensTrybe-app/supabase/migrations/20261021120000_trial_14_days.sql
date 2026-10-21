-- 21 October 2026: paid plans start with 14 days free instead of three months.
-- handle_new_user sets profiles.next_billing_date for a paid signup without a founding code;
-- create-revolut-order turns that into the first charge date. Founding terms are unchanged.
-- Rewrites the one interval in place so the rest of the function stays exactly as it is.
do $do$
declare d text := pg_get_functiondef('public.handle_new_user'::regproc);
begin
  if position($q$interval '3 months'$q$ in d) > 0 then
    execute replace(d, $q$interval '3 months'$q$, $q$interval '14 days'$q$);
  end if;
end
$do$;
