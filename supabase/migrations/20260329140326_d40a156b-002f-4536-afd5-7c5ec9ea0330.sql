ALTER TABLE public.closing_deals ADD COLUMN IF NOT EXISTS motivo_perda text NULL;
ALTER TABLE public.closing_deals ADD COLUMN IF NOT EXISTS motivo_perda_detalhe text NULL;