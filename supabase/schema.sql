-- 企業マスタ
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  note text not null default '',
  invoice_contact_name text not null default '',
  invoice_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 契約
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_type text not null check (product_type in ('bakusoq', 'ninkuboxx', 'other')),
  billing_type text not null default 'monthly' check (billing_type in ('monthly', 'lump_sum')),
  contract_status text not null default 'initial' check (contract_status in ('initial', 'renewed', 'auto_renewing')),
  contract_start_date date not null,
  billing_month text not null,           -- YYYY-MM形式
  billing_day text not null check (billing_day in ('1', '16')),
  duration_months integer not null,
  monthly_fee integer not null default 0,
  fee_months integer not null default 1,
  monthly_close text not null default '0' check (monthly_close in ('-1', '0', '1')),
  monthly_pay text not null default 'same_end' check (monthly_pay in ('same_end', 'next_end', 'next_10', 'next2_10')),
  has_initial_fee boolean not null default false,
  initial_fee integer not null default 0,
  initial_close text not null default '0' check (initial_close in ('-1', '0', '1')),
  initial_pay text not null default 'same_end' check (initial_pay in ('same_end', 'next_end', 'next_10', 'next2_10')),
  has_option boolean not null default false,
  option_name text not null default '',
  option_fee integer not null default 0,
  option_close text not null default '0' check (option_close in ('-1', '0', '1')),
  option_pay text not null default 'same_end' check (option_pay in ('same_end', 'next_end', 'next_10', 'next2_10')),
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

-- プロフィール（ユーザー権限管理）
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- 新規ユーザー登録時に自動でprofileを作成するトリガー
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS（Row Level Security）
alter table companies enable row level security;
alter table contracts enable row level security;
alter table profiles enable row level security;

-- 認証済みユーザーはデータの読み書き可能
create policy "Authenticated users can manage companies"
  on companies for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage contracts"
  on contracts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Admins can update profiles"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
