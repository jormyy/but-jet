-- Reimbursements (e.g. a friend paying you back for dinner) offset spending in their
-- category instead of counting as income.
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'savings', 'reimbursement'));

-- Synced transactions the app can't classify on its own (payments to/from people via
-- Zelle, Venmo, etc.) are flagged until the user says what they were for.
ALTER TABLE transactions ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX transactions_needs_review_idx ON transactions (user_id) WHERE needs_review;
