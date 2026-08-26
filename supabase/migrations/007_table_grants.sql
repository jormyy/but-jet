-- The API roles were never granted anything on these tables. Supabase's hosted
-- project happens to carry the grants because its tables were created by
-- supabase_admin, whose default privileges include them -- but a project built
-- from this migration history alone cannot read or write a single row:
--   supabase db reset && select from any table as `authenticated`
--   -> ERROR: permission denied for table transactions
--
-- Only `authenticated` is granted. Row level security already keeps the anon
-- role out (auth.uid() is null, so `auth.uid() = user_id` never matches), and
-- the app never reads data before signing in.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.merchant_categories,
  public.transactions,
  public.recurring_bills,
  public.net_worth_snapshots,
  public.goals,
  public.investment_holdings
TO authenticated;
