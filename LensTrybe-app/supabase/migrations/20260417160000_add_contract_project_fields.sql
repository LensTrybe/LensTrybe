ALTER TABLE contracts 
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS project_date date;

