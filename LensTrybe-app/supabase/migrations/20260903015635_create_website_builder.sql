alter table public.profiles
  add column if not exists site_service_areas text[] default '{}',
  add column if not exists site_seo_title text,
  add column if not exists site_seo_description text,
  add column if not exists site_show_made_with boolean not null default true;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  page_type text not null,
  template text not null default 't1',
  content jsonb not null default '{}',
  visible boolean not null default true,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (creative_id, page_type)
);
alter table public.site_pages enable row level security;
create index if not exists site_pages_creative_idx on public.site_pages(creative_id);

drop policy if exists "site_pages_select_own" on public.site_pages;
drop policy if exists "site_pages_insert_own" on public.site_pages;
drop policy if exists "site_pages_update_own" on public.site_pages;
drop policy if exists "site_pages_delete_own" on public.site_pages;
drop policy if exists "site_pages_public_read" on public.site_pages;
create policy "site_pages_select_own" on public.site_pages for select using (auth.uid() = creative_id);
create policy "site_pages_insert_own" on public.site_pages for insert with check (auth.uid() = creative_id);
create policy "site_pages_update_own" on public.site_pages for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "site_pages_delete_own" on public.site_pages for delete using (auth.uid() = creative_id);
create policy "site_pages_public_read" on public.site_pages for select
  using (exists (select 1 from public.profiles p where p.id = site_pages.creative_id and p.portfolio_website_active = true));
