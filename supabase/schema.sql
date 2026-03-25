-- 企業マスタ
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 契約
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_type text not null check (product_type in ('bakusoq', 'ninkuboxx', 'other')),
  billing_type text not null default 'monthly' check (billing_type in ('monthly', 'lump_sum')),
  contract_start_date date not null,
  billing_month text not null,           -- YYYY-MM形式
  billing_day text not null check (billing_day in ('1', '16')),
  duration_months integer not null,
  monthly_fee integer not null default 0,
  monthly_close text not null default '0' check (monthly_close in ('-1', '0', '1')),
  monthly_pay text not null default 'same_end' check (monthly_pay in ('same_end', 'next_end', 'next_10')),
  has_initial_fee boolean not null default false,
  initial_fee integer not null default 0,
  initial_close text not null default '0' check (initial_close in ('-1', '0', '1')),
  initial_pay text not null default 'same_end' check (initial_pay in ('same_end', 'next_end', 'next_10')),
  has_option boolean not null default false,
  option_name text not null default '',
  option_fee integer not null default 0,
  option_close text not null default '0' check (option_close in ('-1', '0', '1')),
  option_pay text not null default 'same_end' check (option_pay in ('same_end', 'next_end', 'next_10')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at自動更新トリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_updated_at
  before update on companies
  for each row execute function update_updated_at();

create trigger contracts_updated_at
  before update on contracts
  for each row execute function update_updated_at();

-- RLS（Row Level Security）- 認証なしで全操作許可（初期開発用）
alter table companies enable row level security;
alter table contracts enable row level security;

create policy "Allow all on companies" on companies for all using (true) with check (true);
create policy "Allow all on contracts" on contracts for all using (true) with check (true);
