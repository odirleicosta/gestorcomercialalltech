
-- Create deal_items table for multiple products per deal
CREATE TABLE public.deal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  modelo_id UUID REFERENCES public.machine_catalog(id),
  machine_name TEXT NOT NULL DEFAULT '',
  machine_type TEXT NOT NULL DEFAULT '',
  fob_cost NUMERIC NOT NULL DEFAULT 0,
  preco_venda_fob NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  gross_margin_percent NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.deal_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own deal items"
  ON public.deal_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own deal items"
  ON public.deal_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deal items"
  ON public.deal_items FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own deal items"
  ON public.deal_items FOR DELETE
  USING (user_id = auth.uid());
