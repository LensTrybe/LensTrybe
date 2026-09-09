insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

drop policy if exists "content_media_insert_own" on storage.objects;
drop policy if exists "content_media_update_own" on storage.objects;
drop policy if exists "content_media_delete_own" on storage.objects;

create policy "content_media_insert_own" on storage.objects for insert
  with check (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "content_media_update_own" on storage.objects for update
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "content_media_delete_own" on storage.objects for delete
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
