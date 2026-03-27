-- 企業×月ごとの請求書送信ステータス
CREATE TABLE IF NOT EXISTS invoice_sent_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

ALTER TABLE invoice_sent_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice_sent_status"
  ON invoice_sent_status FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
