ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS skill_type text,
  ADD COLUMN IF NOT EXISTS discipline text;
