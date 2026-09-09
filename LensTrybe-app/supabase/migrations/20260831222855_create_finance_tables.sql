-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  expense_date date not null default current_date,
  merchant text,
  description text,
  category text,
  amount numeric not null default 0,
  gst_amount numeric,
  has_gst boolean not null default true,
  is_deductible boolean not null default true,
  payment_method text,
  receipt_url text,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create index if not exists expenses_creative_idx on public.expenses(creative_id);
create index if not exists expenses_project_idx on public.expenses(project_id);
create index if not exists expenses_date_idx on public.expenses(expense_date);

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_select_own" on public.expenses for select using (auth.uid() = creative_id);
create policy "expenses_insert_own" on public.expenses for insert with check (auth.uid() = creative_id);
create policy "expenses_update_own" on public.expenses for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "expenses_delete_own" on public.expenses for delete using (auth.uid() = creative_id);

-- Finance settings (one row per creative)
create table if not exists public.finance_settings (
  creative_id uuid primary key references auth.users(id) on delete cascade,
  gst_registered boolean not null default false,
  abn text,
  set_aside_percent numeric not null default 30,
  fy_start_month int not null default 7,
  updated_at timestamptz not null default now()
);
alter table public.finance_settings enable row level security;
drop policy if exists "finance_settings_select_own" on public.finance_settings;
drop policy if exists "finance_settings_insert_own" on public.finance_settings;
drop policy if exists "finance_settings_update_own" on public.finance_settings;
create policy "finance_settings_select_own" on public.finance_settings for select using (auth.uid() = creative_id);
create policy "finance_settings_insert_own" on public.finance_settings for insert with check (auth.uid() = creative_id);
create policy "finance_settings_update_own" on public.finance_settings for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);

-- Financial goals (income target per FY)
create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references auth.users(id) on delete cascade,
  period text not null default 'annual',
  financial_year int not null,
  target_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creative_id, financial_year, period)
);
alter table public.financial_goals enable row level security;
drop policy if exists "financial_goals_select_own" on public.financial_goals;
drop policy if exists "financial_goals_insert_own" on public.financial_goals;
drop policy if exists "financial_goals_update_own" on public.financial_goals;
drop policy if exists "financial_goals_delete_own" on public.financial_goals;
create policy "financial_goals_select_own" on public.financial_goals for select using (auth.uid() = creative_id);
create policy "financial_goals_insert_own" on public.financial_goals for insert with check (auth.uid() = creative_id);
create policy "financial_goals_update_own" on public.financial_goals for update using (auth.uid() = creative_id) with check (auth.uid() = creative_id);
create policy "financial_goals_delete_own" on public.financial_goals for delete using (auth.uid() = creative_id);
