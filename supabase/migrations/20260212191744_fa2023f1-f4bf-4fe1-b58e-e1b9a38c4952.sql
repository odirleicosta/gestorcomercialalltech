
-- Create representatives table
CREATE TABLE public.representatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  regiao TEXT,
  meta_mensal_padrao NUMERIC NOT NULL DEFAULT 0,
  comissao_padrao_pct NUMERIC NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own representatives" ON public.representatives FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own representatives" ON public.representatives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own representatives" ON public.representatives FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own representatives" ON public.representatives FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_representatives_updated_at BEFORE UPDATE ON public.representatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create monthly_goals table
CREATE TABLE public.monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  meta_valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(representative_id, mes, ano)
);

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly goals" ON public.monthly_goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own monthly goals" ON public.monthly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly goals" ON public.monthly_goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own monthly goals" ON public.monthly_goals FOR DELETE USING (user_id = auth.uid());

-- Add representative_id to deals
ALTER TABLE public.deals ADD COLUMN representative_id UUID REFERENCES public.representatives(id);
