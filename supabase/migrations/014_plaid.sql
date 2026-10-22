-- Plaid bank connections. RLS is enabled with no policies on purpose: these tables
-- (and the access tokens in them) are only ever touched server-side via the secret key.
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  institution_name TEXT,
  cursor TEXT,
  -- Transactions dated before this are ignored, so linking doesn't duplicate ones already entered by hand
  sync_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_synced_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES plaid_items(id) ON DELETE CASCADE NOT NULL,
  account_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  current_balance DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

-- Links synced transactions back to Plaid so modifications/removals can be applied and re-syncs are idempotent
ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT UNIQUE;
