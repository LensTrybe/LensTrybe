-- Gear marketplace listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  condition text NOT NULL,
  price numeric NOT NULL,
  description text,
  location text,
  open_to_swaps boolean DEFAULT false,
  photos jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON marketplace_listings FOR SELECT
  USING (status = 'active');

CREATE POLICY "Creatives can manage own listings"
  ON marketplace_listings FOR ALL
  USING (auth.uid() = creative_id)
  WITH CHECK (auth.uid() = creative_id);

-- Public bucket for listing images (paths: {user_id}/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace', 'marketplace', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "marketplace_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace');

CREATE POLICY "marketplace_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "marketplace_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "marketplace_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
