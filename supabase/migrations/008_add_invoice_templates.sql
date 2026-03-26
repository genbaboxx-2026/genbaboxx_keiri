-- 請求書テンプレート（プロダクト別）
CREATE TABLE IF NOT EXISTS invoice_templates (
  id text PRIMARY KEY,
  product_type text NOT NULL,
  monthly_label text NOT NULL DEFAULT '月額料金',
  initial_label text NOT NULL DEFAULT '初期導入費',
  option_label text NOT NULL DEFAULT 'オプション',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice_templates"
  ON invoice_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- デフォルトテンプレート
INSERT INTO invoice_templates (id, product_type, monthly_label, initial_label, option_label)
VALUES
  ('bakusoq', 'bakusoq', 'BAKUSOQ月額利用料', '初期導入費', 'オプション'),
  ('ninkuboxx', 'ninkuboxx', 'NiNKUBOXX月額利用料', '初期導入費', 'オプション'),
  ('other', 'other', '月額利用料', '初期導入費', 'オプション')
ON CONFLICT DO NOTHING;
