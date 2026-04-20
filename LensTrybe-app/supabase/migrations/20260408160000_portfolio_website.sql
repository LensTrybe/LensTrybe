-- Portfolio website: profile fields, content table, storage bucket, RLS.
-- Apply via Supabase CLI or dashboard (do not assume this file has been run).

-- ---------------------------------------------------------------------------
-- profiles columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists portfolio_website_active boolean default false,
  add column if not exists portfolio_cover_url text,
  add column if not exists portfolio_headline text,
  add column if not exists portfolio_tagline text,
  add column if not exists portfolio_sections jsonb default '{
    "portfolio_gallery": true,
    "client_reviews": true,
    "services_pricing": true,
    "contact_form": true,
    "content_gallery": true
  }'::jsonb,
  add column if not exists portfolio_website_vanity_url text;

alter table public.profiles
  add column if not exists custom_domain text;

comment on column public.profiles.custom_domain is 'Subdomain slug only (lowercase, hyphens). Full URL: {slug}.lenstrybe.com';
comment on column public.profiles.portfolio_website_vanity_url is 'Elite only: external URL shown as Visit Website on public profile (no DNS setup).';

create unique index if not exists profiles_custom_domain_slug_unique
  on public.profiles (lower(trim(custom_domain)))
  where custom_domain is not null and length(trim(custom_domain)) > 0;

-- ---------------------------------------------------------------------------
-- portfolio_website_content: folders and files (General = files with no folder)
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_website_content (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.profiles (id) on delete cascade,
  content_type text not null check (content_type in ('folder', 'file')),
  parent_folder_id uuid references public.portfolio_website_content (id) on delete cascade,
  name text,
  cover_url text,
  file_url text,
  storage_path text,
  filename text,
  mime_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint portfolio_website_content_folder_name check (
    content_type <> 'folder' or (name is not null and length(trim(name)) > 0)
  ),
  constraint portfolio_website_content_file_fields check (
    content_type <> 'file' or (
      coalesce(file_url, '') <> ''
      and filename is not null
      and length(trim(filename)) > 0
    )
  ),
  constraint portfolio_website_content_folder_no_parent check (
    content_type <> 'folder' or parent_folder_id is null
  )
);

create index if not exists portfolio_website_content_creative_idx
  on public.portfolio_website_content (creative_id);

create index if not exists portfolio_website_content_parent_idx
  on public.portfolio_website_content (parent_folder_id);

alter table public.portfolio_website_content enable row level security;

drop policy if exists "portfolio_website_content_select_own" on public.portfolio_website_content;
create policy "portfolio_website_content_select_own"
  on public.portfolio_website_content for select
  to authenticated
  using (creative_id = auth.uid());

drop policy if exists "portfolio_website_content_insert_own" on public.portfolio_website_content;
create policy "portfolio_website_content_insert_own"
  on public.portfolio_website_content for insert
  to authenticated
  with check (creative_id = auth.uid());

drop policy if exists "portfolio_website_content_update_own" on public.portfolio_website_content;
create policy "portfolio_website_content_update_own"
  on public.portfolio_website_content for update
  to authenticated
  using (creative_id = auth.uid())
  with check (creative_id = auth.uid());

drop policy if exists "portfolio_website_content_delete_own" on public.portfolio_website_content;
create policy "portfolio_website_content_delete_own"
  on public.portfolio_website_content for delete
  to authenticated
  using (creative_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public bucket for published site assets (adjust if you use CDN)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portfolio-website', 'portfolio-website', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "portfolio_website_storage_select_public" on storage.objects;
create policy "portfolio_website_storage_select_public"
  on storage.objects for select
  using (bucket_id = 'portfolio-website');

drop policy if exists "portfolio_website_storage_insert_own" on storage.objects;
create policy "portfolio_website_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-website'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "portfolio_website_storage_update_own" on storage.objects;
create policy "portfolio_website_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portfolio-website'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "portfolio_website_storage_delete_own" on storage.objects;
create policy "portfolio_website_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio-website'
    and split_part(name, '/', 1) = auth.uid()::text
  );
