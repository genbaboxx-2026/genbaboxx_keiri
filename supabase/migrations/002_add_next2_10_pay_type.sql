-- 翌々月10日払い(next2_10)を追加
-- 既存のcheck制約を削除して再作成

alter table contracts drop constraint if exists contracts_monthly_pay_check;
alter table contracts add constraint contracts_monthly_pay_check
  check (monthly_pay in ('same_end', 'next_end', 'next_10', 'next2_10'));

alter table contracts drop constraint if exists contracts_initial_pay_check;
alter table contracts add constraint contracts_initial_pay_check
  check (initial_pay in ('same_end', 'next_end', 'next_10', 'next2_10'));

alter table contracts drop constraint if exists contracts_option_pay_check;
alter table contracts add constraint contracts_option_pay_check
  check (option_pay in ('same_end', 'next_end', 'next_10', 'next2_10'));
