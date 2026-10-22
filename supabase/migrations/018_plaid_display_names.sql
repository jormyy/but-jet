-- The name a linked account appears under (net worth entry / investment holding name).
-- Set once from Plaid's name when first synced, then only changed by the user renaming it,
-- so renames and bank-side nickname changes never break the link to the account.
ALTER TABLE plaid_accounts ADD COLUMN display_name TEXT;
