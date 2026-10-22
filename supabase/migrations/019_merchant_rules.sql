-- The merchant name exactly as the bank reported it, kept on synced transactions so renaming or
-- categorizing one can become a rule for every transaction from that merchant.
ALTER TABLE transactions ADD COLUMN bank_merchant TEXT;
CREATE INDEX transactions_bank_merchant_idx ON transactions (user_id, bank_merchant) WHERE bank_merchant IS NOT NULL;

-- Merchant rules can also show the merchant under the user's name for it,
-- e.g. the bank's "UEP ZHANGLIANG MALATANG" → "Zhangliang".
ALTER TABLE merchant_categories ADD COLUMN rename_to TEXT;
