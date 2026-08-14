-- Invoice create/edit wrote a `notes` field that had no column, causing every
-- insert/update to fail (Create Invoice + Save Draft appeared non-functional).
-- Additive fix.
alter table public.invoices add column if not exists notes text;
