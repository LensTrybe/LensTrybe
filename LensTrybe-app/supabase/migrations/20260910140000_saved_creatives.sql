-- Creatives a user has saved (bookmarked) from the Collaborate hub.
CREATE TABLE IF NOT EXISTS public.saved_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, creative_id)
);

CREATE INDEX IF NOT EXISTS saved_creatives_user_idx ON public.saved_creatives (user_id, created_at DESC);

ALTER TABLE public.saved_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_creatives_select_own" ON public.saved_creatives;
CREATE POLICY "saved_creatives_select_own" ON public.saved_creatives
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_creatives_insert_own" ON public.saved_creatives;
CREATE POLICY "saved_creatives_insert_own" ON public.saved_creatives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_creatives_delete_own" ON public.saved_creatives;
CREATE POLICY "saved_creatives_delete_own" ON public.saved_creatives
  FOR DELETE USING (auth.uid() = user_id);
