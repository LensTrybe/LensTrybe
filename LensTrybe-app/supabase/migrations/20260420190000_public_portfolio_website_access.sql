-- Public portfolio website: allow anyone to read portfolio_website_content rows
-- for creatives who have portfolio_website_active = true (used by /site/:slug).

drop policy if exists "portfolio_website_content_public_select" on public.portfolio_website_content;
create policy "portfolio_website_content_public_select"
  on public.portfolio_website_content
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = portfolio_website_content.creative_id
        and coalesce(p.portfolio_website_active, false) = true
    )
  );
