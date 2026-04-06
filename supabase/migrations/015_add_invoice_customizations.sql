-- 企業×月ごとの請求書カスタマイズ（項目追加・編集・削除・日付変更）
CREATE TABLE IF NOT EXISTS invoice_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

CREATE TRIGGER invoice_customizations_updated_at
  BEFORE UPDATE ON invoice_customizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE invoice_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice_customizations"
  ON invoice_customizations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
