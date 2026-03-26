-- 請求書テンプレートにプリセット項目を追加
ALTER TABLE invoice_templates
  ADD COLUMN IF NOT EXISTS preset_items text NOT NULL DEFAULT '[]';
