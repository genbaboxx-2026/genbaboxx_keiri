-- Add amount column to invoice_sent_status to lock in revenue when invoice is sent
ALTER TABLE invoice_sent_status ADD COLUMN amount integer;
