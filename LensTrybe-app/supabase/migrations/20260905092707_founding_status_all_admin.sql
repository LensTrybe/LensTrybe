-- Admin-only rollup: every founding creative's status in one call.
create or replace function public.founding_status_all()
returns table(
  id uuid,
  business_name text,
  business_email text,
  deal_status text,
  founding_member_since timestamptz,
  listing_complete boolean,
  job_count int,
  last_feedback_at timestamptz
) language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    return; -- non-admins get nothing
  end if;
  return query
    select
      p.id,
      p.business_name,
      p.business_email,
      coalesce(p.founding_deal_status, 'active'),
      p.founding_member_since,
      public.founding_listing_complete(p.id),
      public.founding_job_count(p.id),
      (select max(f.created_at) from public.founding_feedback f where f.creative_id = p.id)
    from public.profiles p
    where p.founding_member = true
    order by p.founding_member_since desc nulls last;
end;
$$;

grant execute on function public.founding_status_all() to authenticated;
