
-- Create empresas table
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own empresas" ON public.empresas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own empresas" ON public.empresas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own empresas" ON public.empresas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own empresas" ON public.empresas FOR DELETE USING (user_id = auth.uid());

-- Add structured FK columns to deals
ALTER TABLE public.deals ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.deals ADD COLUMN modelo_id UUID REFERENCES public.machine_catalog(id);

-- Add manager commission to representatives
ALTER TABLE public.representatives ADD COLUMN comissao_gestor_pct NUMERIC NOT NULL DEFAULT 1;
