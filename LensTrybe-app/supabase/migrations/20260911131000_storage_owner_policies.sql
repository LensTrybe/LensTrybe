-- Storage lockdown. Before: any signed-in user could upload into, overwrite or
-- delete files in other creatives' folders (avatars, portfolio, brand kit,
-- contracts, deliveries, marketplace...), read or delete everyone's credential
-- documents (police checks etc.), and anyone could list every file in the
-- deliveries, contracts, portfolio and message-attachment buckets.
--
-- After: writes, updates, deletes and listing are limited to the caller's own
-- folder. Public buckets still serve files by their public URL (that never goes
-- through these policies), so public images, portfolio sites and delivery links
-- keep working. Newsletter policies (admin-only writes) are left unchanged.
--
-- Folder conventions in use:
--   <uid>/...                                  most buckets
--   contracts/<uid>/..., uploaded_contracts/<uid>/...   contracts bucket
--   credentials/<uid>/... or <uid>/...         credentials bucket
--   deliveries/<uid>/... or <uid>/...          deliveries bucket

create or replace function public.storage_path_is_mine(p_name text)
returns boolean language sql stable set search_path = public as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or (split_part(p_name, '/', 1) in ('contracts', 'uploaded_contracts', 'credentials', 'deliveries')
        and split_part(p_name, '/', 2) = auth.uid()::text)
  )
$$;
grant execute on function public.storage_path_is_mine(text) to anon, authenticated;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and policyname not like 'newsletter_storage_%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy owner_select on storage.objects for select to authenticated
  using (bucket_id <> 'newsletter' and public.storage_path_is_mine(name));
create policy owner_insert on storage.objects for insert to authenticated
  with check (bucket_id <> 'newsletter' and public.storage_path_is_mine(name));
create policy owner_update on storage.objects for update to authenticated
  using (bucket_id <> 'newsletter' and public.storage_path_is_mine(name))
  with check (bucket_id <> 'newsletter' and public.storage_path_is_mine(name));
create policy owner_delete on storage.objects for delete to authenticated
  using (bucket_id <> 'newsletter' and public.storage_path_is_mine(name));

-- Admins/staff can read everything (support), including private credentials.
create policy admin_select on storage.objects for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_admin = true or p.role in ('admin', 'staff'))));
