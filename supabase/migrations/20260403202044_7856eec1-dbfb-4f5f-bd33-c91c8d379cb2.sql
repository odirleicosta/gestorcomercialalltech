CREATE TABLE public.visitas_importadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  representative_id uuid NOT NULL,
  data_visita date NOT NULL,
  cliente text NOT NULL,
  cnpj text,
  assunto text,
  descricao text,
  hash_linha text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visitas_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visitas_importadas" ON public.visitas_importadas FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "Users can insert own visitas_importadas" ON public.visitas_importadas FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own visitas_importadas" ON public.visitas_importadas FOR DELETE TO public USING (user_id = auth.uid());

CREATE UNIQUE INDEX visitas_importadas_hash_unique ON public.visitas_importadas (user_id, hash_linha);