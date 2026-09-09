-- Profile views: logged when someone opens a creative's public profile.
create table if not exists public.profile_views (
  id bigint generated always as identity primary key,
  creative_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists profile_views_creative_idx on public.profile_views (creative_id, created_at);

-- Search impressions: logged when a creative appears in explore/search results.
create table if not exists public.search_impressions (
  id bigint generated always as identity primary key,
  creative_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists search_impressions_creative_idx on public.search_impressions (creative_id, created_at);

alter table public.profile_views enable row level security;
alter table public.search_impressions enable row level security;

-- Anyone (including anonymous visitors) may log a view/impression.
drop policy if exists "profile_views_insert_any" on public.profile_views;
create policy "profile_views_insert_any" on public.profile_views for insert to anon, authenticated with check (true);
drop policy if exists "profile_views_select_own" on public.profile_views;
create policy "profile_views_select_own" on public.profile_views for select to authenticated using (auth.uid() = creative_id);

drop policy if exists "search_impressions_insert_any" on public.search_impressions;
create policy "search_impressions_insert_any" on public.search_impressions for insert to anon, authenticated with check (true);
drop policy if exists "search_impressions_select_own" on public.search_impressions;
create policy "search_impressions_select_own" on public.search_impressions for select to authenticated using (auth.uid() = creative_id);
