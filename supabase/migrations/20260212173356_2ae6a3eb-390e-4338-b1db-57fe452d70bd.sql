
-- Create deals table for negotiations/sales
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  machine_name TEXT NOT NULL DEFAULT '',
  fob_cost NUMERIC NOT NULL DEFAULT 0,
  dollar_rate NUMERIC NOT NULL DEFAULT 0,
  estimated_tax_percent NUMERIC NOT NULL DEFAULT 0,
  estimated_tax_value NUMERIC NOT NULL DEFAULT 0,
  desired_margin_percent NUMERIC NOT NULL DEFAULT 0,
  base_price NUMERIC NOT NULL DEFAULT 0,
  final_price NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  gross_margin_percent NUMERIC NOT NULL DEFAULT 0,
  commission_base TEXT NOT NULL DEFAULT 'FOB' CHECK (commission_base IN ('FOB', 'PRECO_VENDA')),
  seller_commission_pct NUMERIC NOT NULL DEFAULT 0,
  manager_commission_pct NUMERIC NOT NULL DEFAULT 0,
  seller_commission_value NUMERIC NOT NULL DEFAULT 0,
  manager_commission_value NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  net_margin_percent NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMP WITH TIME ZONE,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own deals"
ON public.deals FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own deals"
ON public.deals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own open deals"
ON public.deals FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own open deals"
ON public.deals FOR DELETE
USING (user_id = auth.uid() AND status = 'open');

-- Trigger for updated_at
CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
