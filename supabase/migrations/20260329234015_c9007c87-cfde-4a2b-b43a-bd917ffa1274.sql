CREATE TABLE IF NOT EXISTS public.monthly_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  representative_id uuid NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, representative_id, ano, mes)
);

ALTER TABLE public.monthly_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly_opportunities" ON public.monthly_opportunities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own monthly_opportunities" ON public.monthly_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly_opportunities" ON public.monthly_opportunities FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own monthly_opportunities" ON public.monthly_opportunities FOR DELETE USING (user_id = auth.uid());