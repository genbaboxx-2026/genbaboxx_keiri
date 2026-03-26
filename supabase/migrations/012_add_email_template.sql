-- メールテンプレート設定を追加
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_subject_template text NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_body_template text NOT NULL DEFAULT '';
