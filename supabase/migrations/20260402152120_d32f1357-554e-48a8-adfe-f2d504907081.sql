CREATE TABLE public.weekly_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  representative_id UUID NOT NULL,
  ano INTEGER NOT NULL,
  semana INTEGER NOT NULL,
  qty_proprias INTEGER NOT NULL DEFAULT 0,
  qty_sdr INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, representative_id, ano, semana)
);

ALTER TABLE public.weekly_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly_opportunities" ON public.weekly_opportunities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own weekly_opportunities" ON public.weekly_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly_opportunities" ON public.weekly_opportunities FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own weekly_opportunities" ON public.weekly_opportunities FOR DELETE USING (user_id = auth.uid());