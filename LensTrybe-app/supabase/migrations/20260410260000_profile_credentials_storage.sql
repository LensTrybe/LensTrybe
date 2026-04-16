-- Profile credential flags (public-facing trust signals only; documents stay in private storage).
alter table profiles
  add column if not exists has_public_liability boolean default false,
  add column if not exists has_blue_card boolean default false,
  add column if not exists has_police_check boolean default false,
  add column if not exists has_wwvp boolean default false,
  add column if not exists has_professional_licence boolean default false,
  add column if not exists professional_licence_description text;

-- Private bucket for credential documents. If the bucket already exists, keep it non-public.
insert into storage.buckets (id, name, public)
values ('credentials', 'credentials', false)
on conflict (id) do update set public = excluded.public;

-- App note: you can also create/confirm the bucket under Supabase Dashboard → Storage → New bucket → name: credentials → Private: ON.

drop policy if exists "credentials_select_own" on storage.objects;
drop policy if exists "credentials_insert_own" on storage.objects;
drop policy if exists "credentials_update_own" on storage.objects;
drop policy if exists "credentials_delete_own" on storage.objects;

-- Owner-only access: first path segment must equal auth.uid() (e.g. {user_id}/public_liability_file.pdf).
create policy "credentials_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "credentials_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "credentials_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "credentials_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);
