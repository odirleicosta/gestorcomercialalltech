ALTER TABLE public.closing_deals ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE public.closing_deals ADD COLUMN IF NOT EXISTS lost_reason_detail TEXT;