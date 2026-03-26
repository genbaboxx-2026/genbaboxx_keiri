-- プロフィールテーブル（ユーザー権限管理）
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at自動更新トリガー
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- RLS
alter table profiles enable row level security;

-- 認証済みユーザーは自分のプロフィールを読める
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = user_id);

-- 認証済みユーザーはすべてのプロフィールを読める（管理画面用）
create policy "Authenticated users can read all profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- adminのみプロフィールを更新可能
create policy "Admins can update profiles"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

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
