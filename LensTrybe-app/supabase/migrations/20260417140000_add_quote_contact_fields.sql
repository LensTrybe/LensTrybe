ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS download_token text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE quotes SET download_token = gen_random_uuid()::text WHERE download_token IS NULL;
