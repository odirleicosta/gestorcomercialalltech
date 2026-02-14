-- Allow deleting any own deal (not just open ones)
DROP POLICY IF EXISTS "Users can delete own open deals" ON public.deals;
CREATE POLICY "Users can delete own deals"
  ON public.deals
  FOR DELETE
  USING (user_id = auth.uid());