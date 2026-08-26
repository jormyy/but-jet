-- Every table was reachable only by sequential scan. Row level security filters
-- each query by user_id, so a shared table makes every read proportional to all
-- users' rows, not the signed-in user's:
--   EXPLAIN ANALYZE of the current-month transaction list
--   -> Seq Scan on transactions, Rows Removed by Filter: 1197 of 1228
--
-- The column order matches how the app reads: user first (the RLS predicate),
-- then whatever it filters or orders by.
--
-- Applied to a live project these should be created CONCURRENTLY, outside a
-- transaction, so writes are not blocked while they build.

-- Month list and the six-month cash flow: user + date range, newest first.
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, date DESC);

-- Ordered category list, and the join behind `category:categories(*)`.
CREATE INDEX IF NOT EXISTS categories_user_bucket_name_idx
  ON public.categories (user_id, bucket, name);

-- Bill list, ordered by when it is next due.
CREATE INDEX IF NOT EXISTS recurring_bills_user_due_idx
  ON public.recurring_bills (user_id, next_due_date);

CREATE INDEX IF NOT EXISTS goals_user_created_idx
  ON public.goals (user_id, created_at);

CREATE INDEX IF NOT EXISTS investment_holdings_user_created_idx
  ON public.investment_holdings (user_id, created_at);

-- Foreign keys pointing at categories. Without these, deleting a category has
-- to scan all three referencing tables to apply ON DELETE SET NULL.
CREATE INDEX IF NOT EXISTS transactions_category_idx
  ON public.transactions (category_id) WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS recurring_bills_category_idx
  ON public.recurring_bills (category_id) WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS merchant_categories_category_idx
  ON public.merchant_categories (category_id) WHERE category_id IS NOT NULL;

-- net_worth_snapshots is already covered by the UNIQUE (user_id, date) index
-- that 006 added, which serves both the history read and the latest-first lookup.
