-- Add is_gestor flag to representatives table
ALTER TABLE public.representatives ADD COLUMN is_gestor boolean NOT NULL DEFAULT false;

-- Only one gestor allowed - create partial unique index
CREATE UNIQUE INDEX idx_one_gestor_per_user ON public.representatives (user_id) WHERE is_gestor = true;