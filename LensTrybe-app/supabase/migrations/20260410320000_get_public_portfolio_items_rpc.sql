-- Public portfolio galleries: read rows regardless of portfolio_items RLS (still only returns given creative).
create or replace function public.get_public_portfolio_items(p_creative_id uuid)
returns setof public.portfolio_items
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.portfolio_items
  where creative_id = p_creative_id
  order by sort_order nulls last, created_at desc
  limit 120;
$$;

revoke all on function public.get_public_portfolio_items(uuid) from public;
grant execute on function public.get_public_portfolio_items(uuid) to anon, authenticated;
