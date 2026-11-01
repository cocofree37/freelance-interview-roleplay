-- Supabase SQL Editor で全体を一度実行してください(何度実行しても安全です)。

-- 1) プロフィール(本人だけが読み書きできる)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 8000),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '' check (char_length(full_name) <= 100);
alter table public.profiles add column if not exists headline text not null default '' check (char_length(headline) <= 200);
alter table public.profiles add column if not exists conditions text not null default '' check (char_length(conditions) <= 2000);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (user_id = auth.uid());

-- 2) 職務経歴書などのファイル情報(原本は Storage、抽出した文字はここに保存)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null check (char_length(filename) <= 200),
  storage_path text not null,
  size_bytes int not null check (size_bytes >= 0 and size_bytes <= 5242880),
  content_text text not null default '' check (char_length(content_text) <= 30000),
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;

create policy "documents_select_own" on public.documents
  for select to authenticated using (user_id = auth.uid());
-- 1人あたり最大5ファイル
create policy "documents_insert_own" on public.documents
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (select count(*) from public.documents d where d.user_id = auth.uid()) < 5
  );
create policy "documents_delete_own" on public.documents
  for delete to authenticated using (user_id = auth.uid());

-- 3) 原本の保管場所(非公開。自分のフォルダ `<user_id>/` の中だけ操作できる)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 5242880,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_obj_select_own" on storage.objects;
drop policy if exists "documents_obj_insert_own" on storage.objects;
drop policy if exists "documents_obj_delete_own" on storage.objects;

create policy "documents_obj_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_obj_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_obj_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) ログインユーザーの利用回数(直接アクセス不可。下の関数経由でのみ更新)
create table if not exists public.usage_counters (
  key text not null,
  day date not null,
  count int not null default 0,
  primary key (key, day)
);

alter table public.usage_counters enable row level security;
-- ポリシーを作らない = anon / authenticated からは一切読み書きできない

-- 5) 利用回数の消費。1回の作成で選んだ出力の数(1〜3)だけ消費する。
--    上限はここで固定(利用者が変更できない)。日本時間の日付で集計。
--    per_user_limit: 1人あたり1日 / global_limit: ログインユーザー全体で1日
--    (ゲストの上限は Worker 側で管理)
drop function if exists public.consume_quota();

create or replace function public.consume_quota(p_cost int default 1)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  per_user_limit constant int := 15;
  global_limit constant int := 100;
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  u int;
  g int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_cost is null or p_cost < 1 or p_cost > 3 then
    raise exception 'invalid cost' using errcode = '22023';
  end if;

  insert into usage_counters (key, day, count) values (uid::text, today, 0)
    on conflict (key, day) do nothing;
  insert into usage_counters (key, day, count) values ('global', today, 0)
    on conflict (key, day) do nothing;

  select count into g from usage_counters where key = 'global' and day = today for update;
  select count into u from usage_counters where key = uid::text and day = today for update;

  if u + p_cost > per_user_limit then
    return json_build_object('allowed', false, 'reason', 'user', 'used', u, 'limit', per_user_limit);
  end if;
  if g + p_cost > global_limit then
    return json_build_object('allowed', false, 'reason', 'global', 'used', u, 'limit', per_user_limit);
  end if;

  update usage_counters set count = count + p_cost where key = uid::text and day = today;
  update usage_counters set count = count + p_cost where key = 'global' and day = today;

  return json_build_object('allowed', true, 'used', u + p_cost, 'limit', per_user_limit);
end;
$$;

revoke all on function public.consume_quota(int) from public, anon;
grant execute on function public.consume_quota(int) to authenticated;
