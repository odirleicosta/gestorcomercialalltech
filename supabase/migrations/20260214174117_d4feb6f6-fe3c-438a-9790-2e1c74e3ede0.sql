
-- Table to store strategic plans from the simulator
CREATE TABLE public.strategic_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  qty_machines INTEGER NOT NULL DEFAULT 0,
  ticket_fob NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NOT NULL DEFAULT 0,
  representative_id UUID REFERENCES public.representatives(id),
  dollar_rate NUMERIC DEFAULT 0,
  planned_fob NUMERIC NOT NULL DEFAULT 0,
  planned_gross_profit NUMERIC NOT NULL DEFAULT 0,
  planned_net_profit NUMERIC NOT NULL DEFAULT 0,
  planned_commission NUMERIC NOT NULL DEFAULT 0,
  planned_meta_pct NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategic_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategic plans"
  ON public.strategic_plans FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own strategic plans"
  ON public.strategic_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategic plans"
  ON public.strategic_plans FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own strategic plans"
  ON public.strategic_plans FOR DELETE
  USING (user_id = auth.uid());
