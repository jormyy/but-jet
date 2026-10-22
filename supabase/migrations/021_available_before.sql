-- Money left over from every month before `before`: income and reimbursements in, expenses and
-- savings out. Summed in the database so the app gets one number instead of downloading the
-- whole transaction history (which PostgREST also caps at 1000 rows, making the total wrong).
-- SECURITY INVOKER, so the transactions RLS policy limits it to the caller's own rows.
CREATE OR REPLACE FUNCTION public.available_before(before DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('income', 'reimbursement') THEN amount
      WHEN type IN ('expense', 'savings') THEN -amount
      ELSE 0
    END
  ), 0)
  FROM public.transactions
  WHERE date < before
$$;

REVOKE EXECUTE ON FUNCTION public.available_before(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_before(DATE) TO authenticated;
