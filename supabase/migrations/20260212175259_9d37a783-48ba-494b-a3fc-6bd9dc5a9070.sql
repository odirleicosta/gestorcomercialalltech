
-- Add default commission settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_seller_commission_pct NUMERIC NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS default_manager_commission_pct NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_commission_base TEXT NOT NULL DEFAULT 'FOB';

-- Create commission change history table
CREATE TABLE public.commission_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_changed TEXT NOT NULL,
  old_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commission history"
ON public.commission_history FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own commission history"
ON public.commission_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
