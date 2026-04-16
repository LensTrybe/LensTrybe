-- Client accounts (separate from creative profiles)
create table if not exists public.client_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  company_name text,
  account_type text not null default 'client' check (account_type = 'client'),
  created_at timestamptz default now()
);

create index if not exists client_accounts_email_lower on public.client_accounts (lower(email));

alter table public.client_accounts enable row level security;

drop policy if exists "client_accounts_select_own" on public.client_accounts;
create policy "client_accounts_select_own"
  on public.client_accounts for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "client_accounts_insert_own" on public.client_accounts;
create policy "client_accounts_insert_own"
  on public.client_accounts for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "client_accounts_update_own" on public.client_accounts;
create policy "client_accounts_update_own"
  on public.client_accounts for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional: link client auth user to message threads they started
alter table public.message_threads add column if not exists sender_user_id uuid references auth.users (id);

-- When email confirmation is enabled there is no session after signUp; create client row from auth metadata.
create or replace function public.handle_new_user_client_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data ->> 'account_kind') = 'client' then
    insert into public.client_accounts (id, first_name, last_name, email, company_name, account_type)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'Client'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 'User'),
      coalesce(new.email, ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), ''),
      'client'
    )
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      company_name = excluded.company_name;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_client_account on auth.users;
create trigger on_auth_user_client_account
  after insert on auth.users
  for each row execute function public.handle_new_user_client_account();
