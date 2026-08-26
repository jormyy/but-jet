-- Applying a transaction to the day's balance was a read-modify-write from the
-- browser: read the newest snapshot, add the delta in JavaScript, upsert the
-- result. Two writes that overlap -- adding a transaction while the price
-- refresh rewrites the same row, or two devices at once -- both read the same
-- starting balance and the second silently discards the first.
--
-- Doing it in one statement makes the read and the write atomic, and costs one
-- round trip instead of three.
--
-- SECURITY INVOKER: row level security still applies, so a caller can only ever
-- touch their own snapshot.
CREATE OR REPLACE FUNCTION public.adjust_account_balance(
  account TEXT,
  delta NUMERIC,
  on_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  carried_assets JSONB;
  carried_liabilities JSONB;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Carry the most recent snapshot forward, so a new day starts from yesterday's
  -- balances rather than from zero.
  SELECT s.assets, s.liabilities INTO carried_assets, carried_liabilities
  FROM net_worth_snapshots s
  WHERE s.user_id = uid
  ORDER BY s.date DESC
  LIMIT 1;

  carried_assets := COALESCE(carried_assets, '{}'::jsonb);
  carried_liabilities := COALESCE(carried_liabilities, '{}'::jsonb);

  INSERT INTO net_worth_snapshots AS n (user_id, date, assets, liabilities, total)
  VALUES (
    uid,
    on_date,
    carried_assets || jsonb_build_object(account, COALESCE((carried_assets ->> account)::numeric, 0) + delta),
    carried_liabilities,
    0
  )
  ON CONFLICT (user_id, date) DO UPDATE
  SET assets = n.assets || jsonb_build_object(account, COALESCE((n.assets ->> account)::numeric, 0) + delta);

  UPDATE net_worth_snapshots s
  SET total = (SELECT COALESCE(SUM(v::numeric), 0) FROM jsonb_each_text(s.assets) AS a(k, v))
            - (SELECT COALESCE(SUM(v::numeric), 0) FROM jsonb_each_text(s.liabilities) AS l(k, v))
  WHERE s.user_id = uid AND s.date = on_date;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_account_balance(TEXT, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_account_balance(TEXT, NUMERIC, DATE) TO authenticated;
