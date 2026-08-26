-- auth.uid() is a STABLE function reading a GUC, but written bare in a policy
-- Postgres re-evaluates it for every candidate row. Wrapping it in a scalar
-- subquery lets the planner hoist it into an InitPlan run once per statement.
-- This is Supabase's documented "auth_rls_initplan" advisory.
--
-- WITH CHECK is now spelled out too. Postgres already defaulted it to the USING
-- expression, so this changes nothing about what is allowed -- it just stops the
-- write rule being implied.

DROP POLICY IF EXISTS "users own their categories" ON public.categories;
CREATE POLICY "users own their categories" ON public.categories
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users own their merchant_categories" ON public.merchant_categories;
CREATE POLICY "users own their merchant_categories" ON public.merchant_categories
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users own their transactions" ON public.transactions;
CREATE POLICY "users own their transactions" ON public.transactions
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users own their recurring_bills" ON public.recurring_bills;
CREATE POLICY "users own their recurring_bills" ON public.recurring_bills
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users own their net_worth_snapshots" ON public.net_worth_snapshots;
CREATE POLICY "users own their net_worth_snapshots" ON public.net_worth_snapshots
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users own their goals" ON public.goals;
CREATE POLICY "users own their goals" ON public.goals
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own investment holdings" ON public.investment_holdings;
CREATE POLICY "Users can manage their own investment holdings" ON public.investment_holdings
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
