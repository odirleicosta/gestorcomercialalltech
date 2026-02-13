
-- Add machine_type column to monthly_goals
ALTER TABLE public.monthly_goals 
ADD COLUMN machine_type text NOT NULL DEFAULT 'all';

-- Drop existing unique constraint if any, and add new one including machine_type
-- Create unique constraint to prevent duplicate goals per rep/month/year/type
CREATE UNIQUE INDEX idx_monthly_goals_unique 
ON public.monthly_goals (representative_id, mes, ano, machine_type);
