-- NinKUBOXX用: 月額料金の◯ヶ月分を指定するカラム
alter table contracts
  add column if not exists fee_months integer not null default 1;
