-- Folders (creative-defined categories, shown as tabs)
create table if not exists public.inventory_folders (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.inventory_folders enable row level security;
create index if not exists inv_folders_creative_idx on public.inventory_folders(creative_id);

drop policy if exists "inv_folders_select_own" on public.inventory_folders;
drop policy if exists "inv_folders_insert_own" on public.inventory_folders;
drop policy if exists "inv_folders_update_own" on public.inventory_folders;
drop policy if exists "inv_folders_delete_own" on public.inventory_folders;
create policy "inv_folders_select_own" on public.inventory_folders for select using (auth.uid() = creative_id);
create policy "inv_folders_insert_own" on public.inventory_folders for insert with check (auth.uid() = creative_id);
create policy "inv_folders_update_own" on public.inventory_folders for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "inv_folders_delete_own" on public.inventory_folders for delete using (auth.uid() = creative_id);

-- Items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.inventory_folders(id) on delete set null,
  name text not null,
  sku text,
  quantity int not null default 1,
  unit_value numeric not null default 0,
  reorder_level int not null default 0,
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_items enable row level security;
create index if not exists inv_items_creative_idx on public.inventory_items(creative_id);
create index if not exists inv_items_folder_idx on public.inventory_items(folder_id);

drop policy if exists "inv_items_select_own" on public.inventory_items;
drop policy if exists "inv_items_insert_own" on public.inventory_items;
drop policy if exists "inv_items_update_own" on public.inventory_items;
drop policy if exists "inv_items_delete_own" on public.inventory_items;
create policy "inv_items_select_own" on public.inventory_items for select using (auth.uid() = creative_id);
create policy "inv_items_insert_own" on public.inventory_items for insert with check (auth.uid() = creative_id);
create policy "inv_items_update_own" on public.inventory_items for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "inv_items_delete_own" on public.inventory_items for delete using (auth.uid() = creative_id);

-- Check-outs (quantity out to a project, checked back in on return)
create table if not exists public.inventory_checkouts (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  quantity int not null default 1,
  note text,
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.inventory_checkouts enable row level security;
create index if not exists inv_co_creative_idx on public.inventory_checkouts(creative_id);
create index if not exists inv_co_item_idx on public.inventory_checkouts(item_id);
create index if not exists inv_co_project_idx on public.inventory_checkouts(project_id);

drop policy if exists "inv_co_select_own" on public.inventory_checkouts;
drop policy if exists "inv_co_insert_own" on public.inventory_checkouts;
drop policy if exists "inv_co_update_own" on public.inventory_checkouts;
drop policy if exists "inv_co_delete_own" on public.inventory_checkouts;
create policy "inv_co_select_own" on public.inventory_checkouts for select using (auth.uid() = creative_id);
create policy "inv_co_insert_own" on public.inventory_checkouts for insert with check (auth.uid() = creative_id);
create policy "inv_co_update_own" on public.inventory_checkouts for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "inv_co_delete_own" on public.inventory_checkouts for delete using (auth.uid() = creative_id);
