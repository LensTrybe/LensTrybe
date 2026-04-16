-- Portfolio uploads use storage bucket "portfolio" with getPublicUrl().
-- Without a public bucket + SELECT policy, anon visitors cannot load images on /profile and /portfolio.

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

drop policy if exists "portfolio_select_public" on storage.objects;
create policy "portfolio_select_public"
  on storage.objects for select
  using (bucket_id = 'portfolio');
