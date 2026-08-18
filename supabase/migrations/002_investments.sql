CREATE TABLE investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  ticker TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('401k', 'ira', 'roth_ira', 'brokerage', 'savings', 'crypto', 'other')),
  current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  value_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE investment_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own investment holdings"
  ON investment_holdings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
