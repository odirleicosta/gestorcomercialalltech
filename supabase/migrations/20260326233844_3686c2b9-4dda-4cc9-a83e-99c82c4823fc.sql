
CREATE TYPE public.closing_deal_sale_type AS ENUM ('Rentall', 'Venda Direta');
CREATE TYPE public.closing_deal_stage AS ENUM ('Proposta Enviada', 'Negociação Ativa', 'Decisão Próxima');
CREATE TYPE public.closing_deal_probability AS ENUM ('Baixa', 'Média', 'Alta');
CREATE TYPE public.closing_deal_status AS ENUM ('ativa', 'ganha', 'perdida');

CREATE TABLE public.closing_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  city text,
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  machine_name text NOT NULL DEFAULT '',
  machine_type text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  deal_value numeric NOT NULL DEFAULT 0,
  sale_type public.closing_deal_sale_type NOT NULL DEFAULT 'Venda Direta',
  stage public.closing_deal_stage NOT NULL DEFAULT 'Proposta Enviada',
  probability public.closing_deal_probability NOT NULL DEFAULT 'Média',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_close_date date,
  competitor text,
  trade_in boolean NOT NULL DEFAULT false,
  main_objection text,
  risk_reason text,
  next_step text,
  notes text,
  status public.closing_deal_status NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closing_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own closing_deals" ON public.closing_deals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own closing_deals" ON public.closing_deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own closing_deals" ON public.closing_deals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own closing_deals" ON public.closing_deals FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_closing_deals_updated_at
  BEFORE UPDATE ON public.closing_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
