
-- Drop old unique constraint that doesn't include machine_type
ALTER TABLE public.monthly_goals DROP CONSTRAINT IF EXISTS monthly_goals_representative_id_mes_ano_key;
