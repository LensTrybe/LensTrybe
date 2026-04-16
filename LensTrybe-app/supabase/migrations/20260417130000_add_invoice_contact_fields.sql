ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS client_phone text,
ADD COLUMN IF NOT EXISTS client_address text;
