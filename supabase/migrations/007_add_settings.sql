-- 自社情報設定テーブル（シングルトン）
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'default',
  company_name text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  bank_info text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage settings"
  ON settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- デフォルト行を作成
INSERT INTO settings (id) VALUES ('default') ON CONFLICT DO NOTHING;
