
ALTER TABLE public.visitas_importadas
  DROP CONSTRAINT IF EXISTS visitas_importadas_user_rep_hash_key;
ALTER TABLE public.visitas_importadas
  DROP CONSTRAINT IF EXISTS visitas_importadas_hash_unique;
ALTER TABLE public.visitas_importadas
  DROP CONSTRAINT IF EXISTS visitas_importadas_user_id_hash_linha_key;

DROP INDEX IF EXISTS public.visitas_importadas_hash_unique;
DROP INDEX IF EXISTS public.visitas_importadas_user_rep_hash_key;

ALTER TABLE public.visitas_importadas
  ADD CONSTRAINT visitas_importadas_user_rep_hash_key UNIQUE (user_id, representative_id, hash_linha);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'visitas_importadas'
    AND policyname = 'Users can update their own imported visits'
  ) THEN
    CREATE POLICY "Users can update their own imported visits"
      ON public.visitas_importadas
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
