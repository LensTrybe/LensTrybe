-- Allow clients (anon + authenticated) to read portfolio_items for public galleries.
-- Creatives still manage only their own rows via the second policy.

alter table portfolio_items enable row level security;

drop policy if exists "portfolio_items_public_select" on portfolio_items;
create policy "portfolio_items_public_select"
  on portfolio_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists "portfolio_items_owner_all" on portfolio_items;
create policy "portfolio_items_owner_all"
  on portfolio_items
  for all
  to authenticated
  using (auth.uid() = creative_id)
  with check (auth.uid() = creative_id);
