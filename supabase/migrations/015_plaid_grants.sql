-- Explicit grants for the Plaid sync, following 013_explicit_data_api_grants.sql.
BEGIN;

-- Plaid tables hold bank access tokens: server-only, never reachable from the browser.
REVOKE ALL ON TABLE public.plaid_items, public.plaid_accounts FROM anon, authenticated;

-- Plaid API routes and the plaid-sync cron use service_role.
-- plaid_items: inserted on link, cursor/status updated on sync, deleted on unlink (accounts cascade).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plaid_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.plaid_accounts TO service_role;
-- Synced transactions are upserted, updated, and removed by plaid_transaction_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transactions TO service_role;
-- Merchant memory is read to auto-categorize synced transactions.
GRANT SELECT ON TABLE public.merchant_categories TO service_role;
-- Linked balances are upserted into today's snapshot (SELECT/INSERT already granted in 013).
GRANT UPDATE ON TABLE public.net_worth_snapshots TO service_role;

COMMIT;
