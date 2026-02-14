
-- 1) relatorios_mensais
CREATE TABLE public.relatorios_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes_referencia DATE NOT NULL,
  data_upload TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_geral NUMERIC NOT NULL DEFAULT 0,
  total_alltech NUMERIC NOT NULL DEFAULT 0,
  total_allservice NUMERIC NOT NULL DEFAULT 0,
  arquivo_pdf_url TEXT
);

ALTER TABLE public.relatorios_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relatorios" ON public.relatorios_mensais FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own relatorios" ON public.relatorios_mensais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own relatorios" ON public.relatorios_mensais FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own relatorios" ON public.relatorios_mensais FOR DELETE USING (user_id = auth.uid());

-- 2) comissoes_linhas
CREATE TYPE public.empresa_origem_enum AS ENUM ('ALLTECH', 'ALLSERVICE');

CREATE TABLE public.comissoes_linhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  relatorio_id UUID NOT NULL REFERENCES public.relatorios_mensais(id) ON DELETE CASCADE,
  pedido TEXT NOT NULL,
  cliente TEXT NOT NULL,
  produto TEXT NOT NULL,
  parcela_atual INTEGER NOT NULL DEFAULT 1,
  parcela_total INTEGER NOT NULL DEFAULT 1,
  valor_fob NUMERIC NOT NULL DEFAULT 0,
  percentual_comissao NUMERIC NOT NULL DEFAULT 0,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  empresa_origem public.empresa_origem_enum NOT NULL DEFAULT 'ALLTECH',
  hash_linha TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comissoes_linhas" ON public.comissoes_linhas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own comissoes_linhas" ON public.comissoes_linhas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comissoes_linhas" ON public.comissoes_linhas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comissoes_linhas" ON public.comissoes_linhas FOR DELETE USING (user_id = auth.uid());

CREATE UNIQUE INDEX idx_comissoes_linhas_hash ON public.comissoes_linhas(relatorio_id, hash_linha);

-- 3) auditoria_resultados
CREATE TYPE public.auditoria_status_enum AS ENUM ('OK', 'ALERTA', 'ERRO');

CREATE TABLE public.auditoria_resultados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  relatorio_id UUID NOT NULL REFERENCES public.relatorios_mensais(id) ON DELETE CASCADE,
  pedido TEXT NOT NULL,
  status public.auditoria_status_enum NOT NULL DEFAULT 'OK',
  descricao TEXT,
  diferenca_valor NUMERIC NOT NULL DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auditoria" ON public.auditoria_resultados FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own auditoria" ON public.auditoria_resultados FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own auditoria" ON public.auditoria_resultados FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own auditoria" ON public.auditoria_resultados FOR DELETE USING (user_id = auth.uid());

-- 4) Storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('relatorios-pdf', 'relatorios-pdf', false);

CREATE POLICY "Users can upload own PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'relatorios-pdf' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'relatorios-pdf' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own PDFs" ON storage.objects FOR DELETE USING (bucket_id = 'relatorios-pdf' AND auth.uid()::text = (storage.foldername(name))[1]);
