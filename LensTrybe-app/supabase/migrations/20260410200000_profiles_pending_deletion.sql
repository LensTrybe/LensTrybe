alter table profiles
  add column if not exists pending_deletion boolean default false,
  add column if not exists deletion_scheduled_at timestamptz;
