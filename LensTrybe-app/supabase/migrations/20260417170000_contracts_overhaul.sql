-- Contract templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creatives manage their templates" ON contract_templates;
CREATE POLICY "Creatives manage their templates"
ON contract_templates FOR ALL TO authenticated
USING (creative_id = auth.uid())
WITH CHECK (creative_id = auth.uid());

-- Fix contracts table
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS project_name text,
ADD COLUMN IF NOT EXISTS project_date date,
ADD COLUMN IF NOT EXISTS download_token text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'written';

UPDATE contracts SET download_token = gen_random_uuid()::text WHERE download_token IS NULL;

