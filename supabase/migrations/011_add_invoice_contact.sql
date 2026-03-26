-- 請求書送付先の担当者名・メールアドレスを追加
alter table companies add column if not exists invoice_contact_name text not null default '';
alter table companies add column if not exists invoice_email text not null default '';
