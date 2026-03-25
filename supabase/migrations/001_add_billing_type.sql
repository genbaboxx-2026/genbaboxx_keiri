-- 月額/一括の切り替えカラムを追加
alter table contracts
  add column if not exists billing_type text not null default 'monthly'
  check (billing_type in ('monthly', 'lump_sum'));
