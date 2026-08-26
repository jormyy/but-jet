-- The daily snapshot cron walked every user one at a time: an existence check,
-- a latest-snapshot lookup, a holdings sum and an insert, all sequential. That
-- is four round trips per user, and it is the whole job's runtime.
--
-- The same work is one set-based statement. Semantics are unchanged: carry the
-- previous snapshot forward, fold in the live portfolio total under
-- "Investments" (removing it when the portfolio is empty), skip users who have
-- neither assets nor liabilities, and never overwrite a snapshot that already
-- exists for the day.
CREATE OR REPLACE FUNCTION public.create_daily_snapshots(target_date DATE)
RETURNS TABLE (inserted BIGINT, candidates BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (user_id) user_id, assets, liabilities
    FROM net_worth_snapshots
    WHERE date < target_date
    ORDER BY user_id, date DESC
  ),
  portfolio AS (
    SELECT user_id, SUM(current_value) AS total
    FROM investment_holdings
    GROUP BY user_id
  ),
  candidate AS (
    SELECT
      COALESCE(l.user_id, p.user_id) AS user_id,
      CASE WHEN COALESCE(p.total, 0) > 0
        THEN COALESCE(l.assets, '{}'::jsonb) || jsonb_build_object('Investments', p.total)
        ELSE COALESCE(l.assets, '{}'::jsonb) - 'Investments'
      END AS assets,
      COALESCE(l.liabilities, '{}'::jsonb) AS liabilities
    FROM latest l
    FULL OUTER JOIN portfolio p ON p.user_id = l.user_id
  ),
  eligible AS (
    SELECT * FROM candidate
    WHERE assets <> '{}'::jsonb OR liabilities <> '{}'::jsonb
  ),
  written AS (
    INSERT INTO net_worth_snapshots (user_id, date, assets, liabilities, total)
    SELECT
      e.user_id,
      target_date,
      e.assets,
      e.liabilities,
      (SELECT COALESCE(SUM(v::numeric), 0) FROM jsonb_each_text(e.assets) AS a(k, v))
        - (SELECT COALESCE(SUM(v::numeric), 0) FROM jsonb_each_text(e.liabilities) AS l(k, v))
    FROM eligible e
    ON CONFLICT (user_id, date) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM written), (SELECT count(*) FROM eligible);
END;
$$;

-- Only the cron, which runs as service_role, has any business calling this.
REVOKE ALL ON FUNCTION public.create_daily_snapshots(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_snapshots(DATE) TO service_role;
