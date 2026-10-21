-- Make table access independent of Supabase's automatic public-schema grants.
-- Additive and safe to replay: no schema, data, RLS policy, or default changes.
-- These grants match the current app and cron routes; no anon access is added.
BEGIN;

-- Browser clients remain limited to their own rows by the existing RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.transactions,
  public.goals,
  public.investment_holdings
TO authenticated;

-- Merchant memory is read and upserted, never directly deleted by the app.
GRANT SELECT, INSERT, UPDATE ON TABLE public.merchant_categories
TO authenticated;

-- Bills are listed, created, and deleted; the app has no bill-update route.
GRANT SELECT, INSERT, DELETE ON TABLE public.recurring_bills
TO authenticated;

-- Snapshots are read, upserted, and edited, never directly deleted by the app.
GRANT SELECT, INSERT, UPDATE ON TABLE public.net_worth_snapshots
TO authenticated;

-- Trusted cron routes use service_role, which bypasses RLS but still needs grants.
-- refresh-prices: read holdings, then update only the computed price fields.
-- snapshot: read holdings/snapshots and insert today's snapshot if absent.
GRANT SELECT ON TABLE public.investment_holdings TO service_role;
GRANT UPDATE (last_price, current_value, value_date)
ON TABLE public.investment_holdings TO service_role;
GRANT SELECT, INSERT ON TABLE public.net_worth_snapshots TO service_role;

COMMIT;
