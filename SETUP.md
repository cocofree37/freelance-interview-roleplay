# セットアップ手順(ログイン + AI生成を有効にする)

セットアップ前は、ログイン不要の簡易版(テンプレート+キーワード判定)で動作します。
以下を完了すると、ログイン・経歴保存・AI生成が有効になります。

```
ブラウザ(GitHub Pages) ──ログイン/経歴の保存──▶ Supabase (Auth + DB)
        │
        └─ 案件+ログイン情報 ──▶ Cloudflare Worker ──▶ Claude API
                                    ├─ Supabaseで本人確認・経歴取得・利用回数の消費
                                    └─ URLなら本文を取得
```

## 1. Supabase

1. [supabase.com](https://supabase.com/dashboard) でプロジェクトを作成(無料枠で動作)
2. **SQL Editor** で [supabase/schema.sql](supabase/schema.sql) の内容をすべて貼り付けて実行
3. **Authentication → URL Configuration** を設定
   - Site URL: `https://cocofree37.github.io/freelance-interview-roleplay/`
   - Redirect URLs にも同じURLを追加
4. **Project Settings → API** から次の2つを控える
   - Project URL(`https://xxxx.supabase.co`)
   - `anon` `public` キー(公開前提のキー。`service_role` キーは絶対に使わない・コミットしない)

> ログインはメールのリンク(マジックリンク)方式です。Supabase無料枠の標準メール送信は回数制限が厳しいため、利用者が増える場合は Authentication → SMTP Settings で独自SMTPを設定してください。

## 2. Cloudflare Worker

```bash
cd worker
```

1. [wrangler.toml](worker/wrangler.toml) の `SUPABASE_URL` と `SUPABASE_ANON_KEY` に、1.で控えた値を設定
2. ログインとAPIキーの登録(キーはコマンド後のプロンプトに貼り付け。ファイルやチャットには書かない)

```bash
wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

3. 表示された `https://freelance-interview-questions.<サブドメイン>.workers.dev` を控える

## 3. フロントエンド

[index.html](index.html) の先頭付近にある設定を埋めて push します。

```js
var CONFIG = { SUPABASE_URL: 'https://xxxx.supabase.co', SUPABASE_ANON_KEY: '(anonキー)', WORKER_URL: 'https://....workers.dev' };
```

## 費用と上限

- 利用回数の上限は [supabase/schema.sql](supabase/schema.sql) の `consume_quota` 内で固定しています(1人あたり1日10回、全体で1日100回。日本時間で集計)。変更する場合はその2つの定数を書き換えて再実行してください。
- 提案文の作成は「追加質問」と「最終生成」で最大2回分を消費します。
- 1回あたりの目安は約1〜3円(claude-sonnet-5)。全体上限の1日100回なら最大でも数百円/日です。
- あわせて、Anthropic Console 側で月の利用上限(Spend limit)を設定しておくことを推奨します。

## 個人情報の扱い

- 経歴は Supabase の `profiles` テーブルに保存され、行レベルセキュリティで本人以外は読み書きできません。
- 案件内容・経歴は生成のため Anthropic の API に送信されます。公開する場合は、その旨を利用者に明示してください(画面下部に注記済み)。
- 利用者は画面から保存した経歴をいつでも削除できます。アカウント自体の削除は Supabase の管理画面(Authentication → Users)から行います。
