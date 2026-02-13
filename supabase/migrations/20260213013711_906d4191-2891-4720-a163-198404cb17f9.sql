
-- Create weekly visits tracking table
CREATE TABLE public.weekly_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  semana INTEGER NOT NULL, -- ISO week number (1-53)
  quantidade INTEGER NOT NULL DEFAULT 0,
  meta INTEGER NOT NULL DEFAULT 16,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, representative_id, ano, semana)
);

-- Enable RLS
ALTER TABLE public.weekly_visits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own weekly visits"
  ON public.weekly_visits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own weekly visits"
  ON public.weekly_visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly visits"
  ON public.weekly_visits FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own weekly visits"
  ON public.weekly_visits FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_weekly_visits_updated_at
  BEFORE UPDATE ON public.weekly_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
