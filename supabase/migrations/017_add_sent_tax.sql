-- Add tax column to store actual tax amount (not flat 10%)
ALTER TABLE invoice_sent_status ADD COLUMN IF NOT EXISTS tax integer;
