-- Content pipeline stages (customizable columns)
create table if not exists public.content_stages (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b8f9a',
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.content_stages enable row level security;
create index if not exists content_stages_creative_idx on public.content_stages(creative_id);
drop policy if exists "content_stages_select_own" on public.content_stages;
drop policy if exists "content_stages_insert_own" on public.content_stages;
drop policy if exists "content_stages_update_own" on public.content_stages;
drop policy if exists "content_stages_delete_own" on public.content_stages;
create policy "content_stages_select_own" on public.content_stages for select using (auth.uid() = creative_id);
create policy "content_stages_insert_own" on public.content_stages for insert with check (auth.uid() = creative_id);
create policy "content_stages_update_own" on public.content_stages for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "content_stages_delete_own" on public.content_stages for delete using (auth.uid() = creative_id);

-- Posts
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  stage_id uuid references public.content_stages(id) on delete set null,
  title text,
  caption text,
  hashtags text,
  format text,
  platforms text[] not null default '{}',
  scheduled_date date,
  scheduled_time time,
  media_path text,
  notes text,
  assigned_to uuid references public.team_members(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_posts enable row level security;
create index if not exists content_posts_creative_idx on public.content_posts(creative_id);
create index if not exists content_posts_stage_idx on public.content_posts(stage_id);
create index if not exists content_posts_date_idx on public.content_posts(scheduled_date);
drop policy if exists "content_posts_select_own" on public.content_posts;
drop policy if exists "content_posts_insert_own" on public.content_posts;
drop policy if exists "content_posts_update_own" on public.content_posts;
drop policy if exists "content_posts_delete_own" on public.content_posts;
create policy "content_posts_select_own" on public.content_posts for select using (auth.uid() = creative_id);
create policy "content_posts_insert_own" on public.content_posts for insert with check (auth.uid() = creative_id);
create policy "content_posts_update_own" on public.content_posts for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "content_posts_delete_own" on public.content_posts for delete using (auth.uid() = creative_id);

-- Ideas backlog
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  title text,
  notes text,
  platforms text[] not null default '{}',
  converted_post_id uuid references public.content_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_ideas enable row level security;
create index if not exists content_ideas_creative_idx on public.content_ideas(creative_id);
drop policy if exists "content_ideas_select_own" on public.content_ideas;
drop policy if exists "content_ideas_insert_own" on public.content_ideas;
drop policy if exists "content_ideas_update_own" on public.content_ideas;
drop policy if exists "content_ideas_delete_own" on public.content_ideas;
create policy "content_ideas_select_own" on public.content_ideas for select using (auth.uid() = creative_id);
create policy "content_ideas_insert_own" on public.content_ideas for insert with check (auth.uid() = creative_id);
create policy "content_ideas_update_own" on public.content_ideas for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "content_ideas_delete_own" on public.content_ideas for delete using (auth.uid() = creative_id);
