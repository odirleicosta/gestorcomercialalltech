
-- Remove any old unique constraints/indexes on (user_id, hash_linha)
DROP INDEX IF EXISTS public.visitas_importadas_hash_unique;
ALTER TABLE public.visitas_importadas DROP CONSTRAINT IF EXISTS visitas_importadas_user_id_hash_linha_key;
ALTER TABLE public.visitas_importadas DROP CONSTRAINT IF EXISTS visitas_importadas_hash_unique;

-- Ensure the correct composite unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'visitas_importadas'
    AND indexname = 'visitas_importadas_user_rep_hash_key'
  ) THEN
    CREATE UNIQUE INDEX visitas_importadas_user_rep_hash_key
    ON public.visitas_importadas (user_id, representative_id, hash_linha);
  END IF;
END $$;
