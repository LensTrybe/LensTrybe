CREATE TABLE IF NOT EXISTS job_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  posted_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  creative_types text[] DEFAULT '{}'::text[],
  specialty text,
  location text,
  job_date date,
  budget_range text,
  description text NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active job listings"
  ON job_listings FOR SELECT
  USING (status = 'active' AND expires_at > now());

CREATE POLICY "Users can manage own job listings"
  ON job_listings FOR ALL
  USING (auth.uid() = posted_by)
  WITH CHECK (auth.uid() = posted_by);
