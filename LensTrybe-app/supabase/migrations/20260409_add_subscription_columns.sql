alter table profiles
add column if not exists subscription_tier text default 'basic',
add column if not exists subscription_status text default 'active',
add column if not exists stripe_customer_id text;

