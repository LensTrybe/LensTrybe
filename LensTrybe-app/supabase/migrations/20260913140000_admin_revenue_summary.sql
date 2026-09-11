-- Admin revenue numbers from real subscriptions (not from profile plan tiers).
--  * MRR counts subscriptions that are actually paying: status active or past_due.
--    Annual plans count as a twelfth of the yearly price. Complimentary accounts (comp_tier,
--    admin and test accounts) have no paying subscription, so they don't count.
--  * Trialing subscriptions (paid-plan trials and founding free years) are reported
--    separately and don't count towards MRR.
create or replace function public.admin_revenue_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and (coalesce(is_admin, false) or coalesce(role, '') in ('admin', 'staff'))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'mrr_minor', coalesce(round(sum(case when status in ('active', 'past_due')
                   then case when billing = 'annual' then amount_minor / 12.0 else amount_minor end
                   else 0 end)), 0),
    'paying', count(*) filter (where status in ('active', 'past_due')),
    'past_due', count(*) filter (where status = 'past_due'),
    'annual', count(*) filter (where status in ('active', 'past_due') and billing = 'annual'),
    'founding_paying', count(*) filter (where status in ('active', 'past_due') and founding_member),
    'trialing', count(*) filter (where status = 'trialing'),
    'by_tier', coalesce((
      select jsonb_object_agg(t, n) from (
        select lower(tier) t, count(*) n from public.subscriptions
         where status in ('active', 'past_due') group by lower(tier)) x), '{}'::jsonb)
  ) into v
  from public.subscriptions;
  return v;
end $$;
revoke all on function public.admin_revenue_summary() from public, anon;
grant execute on function public.admin_revenue_summary() to authenticated;
