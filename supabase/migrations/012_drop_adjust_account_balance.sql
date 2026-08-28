-- Reverts 011_adjust_account_balance.sql. The PR that introduced this
-- function was unmerged, and nothing calls it anymore.
DROP FUNCTION IF EXISTS public.adjust_account_balance(TEXT, NUMERIC, DATE);
