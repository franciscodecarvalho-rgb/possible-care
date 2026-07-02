
DROP POLICY IF EXISTS bureaus_select_authenticated ON public.bureaus;
CREATE POLICY bureaus_select_authenticated ON public.bureaus
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin());

DROP POLICY IF EXISTS bureaus_update_authenticated ON public.bureaus;
CREATE POLICY bureaus_update_authenticated ON public.bureaus
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = created_by OR public.is_current_user_admin());

DROP POLICY IF EXISTS clientes_select_authenticated ON public.clientes;
CREATE POLICY clientes_select_authenticated ON public.clientes
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin());

DROP POLICY IF EXISTS clientes_update_authenticated ON public.clientes;
CREATE POLICY clientes_update_authenticated ON public.clientes
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = created_by OR public.is_current_user_admin());
