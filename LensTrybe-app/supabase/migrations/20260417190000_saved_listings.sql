-- Saved marketplace listings per user
CREATE TABLE IF NOT EXISTS saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own saved listings" ON saved_listings;

CREATE POLICY "Users manage their own saved listings"
  ON saved_listings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
