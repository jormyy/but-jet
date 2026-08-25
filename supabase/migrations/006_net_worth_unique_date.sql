-- Prevent duplicate net worth snapshots for the same user/date, which caused
-- "latest snapshot" lookups across the app to nondeterministically pick between
-- stale/partial rows (e.g. a cash transaction landing on a row that predated
-- the user's "Cash" asset entry, wiping it back to $0).
ALTER TABLE net_worth_snapshots ADD CONSTRAINT net_worth_snapshots_user_date_key UNIQUE (user_id, date);
