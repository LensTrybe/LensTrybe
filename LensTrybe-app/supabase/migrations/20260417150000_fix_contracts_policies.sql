ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creatives can manage their contracts" ON contracts;
CREATE POLICY "Creatives can manage their contracts"
ON contracts FOR ALL TO authenticated
USING (creative_id = auth.uid())
WITH CHECK (creative_id = auth.uid());

DROP POLICY IF EXISTS "Allow insert for authenticated" ON contracts;
CREATE POLICY "Allow insert for authenticated"
ON contracts FOR INSERT TO authenticated
WITH CHECK (creative_id = auth.uid());

