-- Plaid connections are either bank accounts (transactions + balances) or
-- investment accounts (Fidelity, ADP, etc.) synced as holdings.
ALTER TABLE plaid_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'bank'
  CHECK (kind IN ('bank', 'investments'));

-- A synced investment account shows up as one holding, refreshed on each sync
-- and removed along with the account when it's unlinked.
ALTER TABLE investment_holdings ADD COLUMN plaid_account_id TEXT UNIQUE
  REFERENCES plaid_accounts(account_id) ON DELETE CASCADE;

-- The Plaid sync creates and refreshes those holdings (013 only granted price-field updates).
GRANT INSERT, UPDATE ON TABLE public.investment_holdings TO service_role;
