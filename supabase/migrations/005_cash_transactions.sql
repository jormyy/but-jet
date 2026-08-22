-- Track whether a transaction was paid/received in cash (affects the "Cash" balance instead of "Checking")
ALTER TABLE transactions ADD COLUMN is_cash BOOLEAN NOT NULL DEFAULT FALSE;
