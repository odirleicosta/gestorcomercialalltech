
-- Create machine catalog table
CREATE TABLE public.machine_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  custo_fob NUMERIC NOT NULL DEFAULT 0,
  informado_por TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machine_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage their own catalog entries
CREATE POLICY "Users can view own catalog" ON public.machine_catalog FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert catalog" ON public.machine_catalog FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catalog" ON public.machine_catalog FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own catalog" ON public.machine_catalog FOR DELETE USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_machine_catalog_updated_at
BEFORE UPDATE ON public.machine_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
