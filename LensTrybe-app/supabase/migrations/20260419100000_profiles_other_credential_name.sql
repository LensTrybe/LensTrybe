-- Custom label for "Other" credential on public profile / edit profile
alter table public.profiles
  add column if not exists other_credential_name text;
