-- 契約ステータス: 初回契約 / 継続契約中 / 自動更新中
alter table contracts
  add column if not exists contract_status text not null default 'initial'
  check (contract_status in ('initial', 'renewed', 'auto_renewing'));
