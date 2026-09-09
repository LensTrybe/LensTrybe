insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', false)
on conflict (id) do nothing;

drop policy if exists "inventory_select_own" on storage.objects;
drop policy if exists "inventory_insert_own" on storage.objects;
drop policy if exists "inventory_update_own" on storage.objects;
drop policy if exists "inventory_delete_own" on storage.objects;

create policy "inventory_select_own" on storage.objects for select
  using (bucket_id = 'inventory' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inventory_insert_own" on storage.objects for insert
  with check (bucket_id = 'inventory' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inventory_update_own" on storage.objects for update
  using (bucket_id = 'inventory' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inventory_delete_own" on storage.objects for delete
  using (bucket_id = 'inventory' and (storage.foldername(name))[1] = auth.uid()::text);
