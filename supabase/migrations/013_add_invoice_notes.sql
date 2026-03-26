-- 企業×月ごとの請求書備考を保存
CREATE TABLE IF NOT EXISTS invoice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

CREATE TRIGGER invoice_notes_updated_at
  BEFORE UPDATE ON invoice_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE invoice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice_notes"
  ON invoice_notes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
