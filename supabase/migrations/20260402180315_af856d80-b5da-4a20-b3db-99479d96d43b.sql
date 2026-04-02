
CREATE TABLE public.negociacoes_perdidas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  representative_id UUID REFERENCES public.representatives(id),
  client_name TEXT NOT NULL,
  machine_name TEXT NOT NULL DEFAULT '',
  machine_type TEXT NOT NULL DEFAULT '',
  deal_value NUMERIC NOT NULL DEFAULT 0,
  motivo_perda TEXT,
  motivo_perda_detalhe TEXT,
  data_perda DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.negociacoes_perdidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own negociacoes_perdidas"
  ON public.negociacoes_perdidas FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own negociacoes_perdidas"
  ON public.negociacoes_perdidas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own negociacoes_perdidas"
  ON public.negociacoes_perdidas FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own negociacoes_perdidas"
  ON public.negociacoes_perdidas FOR DELETE TO authenticated
  USING (user_id = auth.uid());
