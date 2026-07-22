
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.assign_lead_code() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Authenticated update leads" ON public.leads;
CREATE POLICY "Authenticated update leads" ON public.leads FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth insert activities" ON public.lead_activities;
CREATE POLICY "Auth insert activities" ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor);
