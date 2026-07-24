DROP POLICY IF EXISTS "campaigns_all_auth" ON public.campaigns;
CREATE POLICY "campaigns_all_auth"
ON public.campaigns
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "invoice_items_all_auth" ON public.invoice_items;
CREATE POLICY "invoice_items_all_auth"
ON public.invoice_items
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "invoices_all_auth" ON public.invoices;
CREATE POLICY "invoices_all_auth"
ON public.invoices
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mp_all_auth" ON public.marketplace_purchases;
CREATE POLICY "mp_all_auth"
ON public.marketplace_purchases
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "partners_all_auth" ON public.partners;
CREATE POLICY "partners_all_auth"
ON public.partners
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_all_auth" ON public.tasks;
CREATE POLICY "tasks_all_auth"
ON public.tasks
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);