-- Supabase SQL Editor で全体を一度実行してください。

-- 1) 応募者の経歴・実績(本人だけが読み書きできる)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 8000),
  updated_at timestamptz not null default now()
);

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

-- 2) 利用回数カウンタ(直接アクセス不可。下の関数経由でのみ更新)
create table if not exists public.usage_counters (
  key text not null,
  day date not null,
  count int not null default 0,
  primary key (key, day)
);

alter table public.usage_counters enable row level security;
-- ポリシーを作らない = anon / authenticated からは一切読み書きできない

-- 3) 利用回数の消費。上限値はここで固定(利用者が変更できない)
--    per_user: 1人あたり1日の上限 / global: 全体で1日の上限(いずれも日本時間の日付で集計)
create or replace function public.consume_quota()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  per_user_limit constant int := 10;
  global_limit constant int := 100;
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  u int;
  g int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into usage_counters (key, day, count) values (uid::text, today, 0)
    on conflict (key, day) do nothing;
  insert into usage_counters (key, day, count) values ('global', today, 0)
    on conflict (key, day) do nothing;

  select count into g from usage_counters where key = 'global' and day = today for update;
  select count into u from usage_counters where key = uid::text and day = today for update;

  if u >= per_user_limit then
    return json_build_object('allowed', false, 'reason', 'user', 'used', u, 'limit', per_user_limit);
  end if;
  if g >= global_limit then
    return json_build_object('allowed', false, 'reason', 'global', 'used', u, 'limit', per_user_limit);
  end if;

  update usage_counters set count = count + 1 where key = uid::text and day = today;
  update usage_counters set count = count + 1 where key = 'global' and day = today;

  return json_build_object('allowed', true, 'used', u + 1, 'limit', per_user_limit);
end;
$$;

revoke all on function public.consume_quota() from public, anon;
grant execute on function public.consume_quota() to authenticated;
