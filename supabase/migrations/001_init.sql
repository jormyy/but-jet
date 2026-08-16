-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('bills', 'spending', 'savings')),
  color TEXT DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant → category memory
CREATE TABLE merchant_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE(user_id, merchant)
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'savings')),
  merchant TEXT,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring bills
CREATE TABLE recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'annual', 'weekly')),
  next_due_date DATE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Net worth snapshots
CREATE TABLE net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  assets JSONB NOT NULL DEFAULT '{}',
  liabilities JSONB NOT NULL DEFAULT '{}',
  total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  target_date DATE,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  type TEXT DEFAULT 'retirement',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their merchant_categories" ON merchant_categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their recurring_bills" ON recurring_bills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their net_worth_snapshots" ON net_worth_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their goals" ON goals FOR ALL USING (auth.uid() = user_id);
