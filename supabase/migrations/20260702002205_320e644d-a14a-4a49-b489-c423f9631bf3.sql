
-- Helper: is current user admin (SECURITY DEFINER to avoid recursive RLS on profiles)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$;

-- Fix mutable search_path on existing function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- analises: restrict SELECT and UPDATE to owner or admin
DROP POLICY IF EXISTS analises_select_authenticated ON public.analises;
CREATE POLICY analises_select_authenticated ON public.analises
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin());

DROP POLICY IF EXISTS analises_update_authenticated ON public.analises;
CREATE POLICY analises_update_authenticated ON public.analises
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = created_by OR public.is_current_user_admin());

-- profiles: restrict SELECT to self or admin
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());

-- profiles: prevent self privilege escalation (is_admin can only be kept same, unless admin)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin())
  WITH CHECK (
    (auth.uid() = id OR public.is_current_user_admin())
    AND (
      public.is_current_user_admin()
      OR is_admin = false
    )
  );
