
-- Add machine_type column to deals table
ALTER TABLE public.deals ADD COLUMN machine_type TEXT NOT NULL DEFAULT '';

-- Add meta_quantidade to representatives for quantity-based goals
ALTER TABLE public.representatives ADD COLUMN meta_quantidade INTEGER NOT NULL DEFAULT 0;

-- Add meta_quantidade to monthly_goals for specific month overrides
ALTER TABLE public.monthly_goals ADD COLUMN meta_quantidade INTEGER NOT NULL DEFAULT 0;
