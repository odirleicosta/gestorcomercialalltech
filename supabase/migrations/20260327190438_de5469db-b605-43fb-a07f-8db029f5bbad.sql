
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  representative_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedbacks" ON public.feedbacks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own feedbacks" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedbacks" ON public.feedbacks FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own feedbacks" ON public.feedbacks FOR DELETE TO authenticated USING (user_id = auth.uid());
