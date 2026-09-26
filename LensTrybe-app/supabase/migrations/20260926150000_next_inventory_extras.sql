-- Inventory in the new workspace: insurance, next service date, in the main kit, packed for the next shoot.
alter table public.inventory_items add column if not exists insured boolean not null default false, add column if not exists service_date date, add column if not exists in_kit boolean not null default false, add column if not exists packed boolean not null default false;
