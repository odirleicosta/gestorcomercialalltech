
-- Drop the old unique constraint on (user_id, hash_linha)
ALTER TABLE public.visitas_importadas DROP CONSTRAINT IF EXISTS visitas_importadas_user_id_hash_linha_key;
DROP INDEX IF EXISTS visitas_importadas_user_id_hash_linha_key;
DROP INDEX IF EXISTS idx_visitas_importadas_user_hash;

-- Create new unique constraint on (user_id, representative_id, hash_linha)
ALTER TABLE public.visitas_importadas ADD CONSTRAINT visitas_importadas_user_rep_hash_key UNIQUE (user_id, representative_id, hash_linha);
