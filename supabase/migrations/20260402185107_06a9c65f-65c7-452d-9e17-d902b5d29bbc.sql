
ALTER TABLE public.monthly_opportunities
  ADD COLUMN IF NOT EXISTS qty_proprias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_sdr integer NOT NULL DEFAULT 0;

ALTER TABLE public.monthly_opportunities
  DROP CONSTRAINT IF EXISTS monthly_opportunities_pkey;

ALTER TABLE public.monthly_opportunities
  ADD CONSTRAINT monthly_opportunities_unique UNIQUE (user_id, representative_id, ano, mes);
