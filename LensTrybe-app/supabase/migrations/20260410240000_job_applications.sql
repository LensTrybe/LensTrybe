CREATE TABLE IF NOT EXISTS job_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (job_id, creative_id)
);

CREATE INDEX IF NOT EXISTS job_applications_job_id_idx ON job_applications (job_id);
CREATE INDEX IF NOT EXISTS job_applications_creative_id_idx ON job_applications (creative_id);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives insert own application"
  ON job_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creative_id
    AND EXISTS (
      SELECT 1 FROM job_listings j
      WHERE j.id = job_applications.job_id
        AND j.status = 'active'
        AND j.expires_at > now()
    )
  );

CREATE POLICY "Creatives see own applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = creative_id);

CREATE OR REPLACE FUNCTION public.job_application_counts(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, application_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ja.job_id, COUNT(*)::bigint
  FROM job_applications ja
  INNER JOIN job_listings jl ON jl.id = ja.job_id
  WHERE (p_job_ids IS NULL OR cardinality(p_job_ids) = 0 OR ja.job_id = ANY (p_job_ids))
    AND jl.status = 'active'
    AND jl.expires_at > now()
  GROUP BY ja.job_id;
$$;

GRANT EXECUTE ON FUNCTION public.job_application_counts(uuid[]) TO anon, authenticated;
