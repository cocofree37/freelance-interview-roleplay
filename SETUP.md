# セットアップ手順

以下を完了すると、ログイン・ファイル保管・AI生成が有効になります。設定前は「現在ご利用いただけません」と表示されます。
スキーマ(`supabase/schema.sql`)を更新したときは、SQL Editor で全文をもう一度実行してください(何度実行しても安全です)。

```
ブラウザ(GitHub Pages) ──ログイン/プロフィール/ファイルの保存──▶ Supabase (Auth + DB + Storage)
        │
        └─ 案件(+ログイン情報) ──▶ Cloudflare Worker ──▶ Claude API
                                    ├─ ログイン時: Supabaseで本人確認・プロフィールとファイルの取得・利用回数の消費
                                    ├─ ゲスト時: Cloudflare KV で利用回数を管理(保存はしない)
                                    └─ URLなら本文を取得
```

## 1. Supabase

1. [supabase.com](https://supabase.com/dashboard) でプロジェクトを作成(無料枠で動作)
2. **SQL Editor** で [supabase/schema.sql](supabase/schema.sql) の内容をすべて貼り付けて実行(テーブル・ファイル保管領域・利用回数の関数が作られます)
3. **Authentication → URL Configuration** を設定
   - Site URL: `https://cocofree37.github.io/freelance-interview-roleplay/`
   - Redirect URLs にも同じURLを追加
4. **Project Settings → API** から次の2つを控える
   - Project URL(`https://xxxx.supabase.co`)
   - `anon` `public` キー(公開前提のキー。`service_role` キーは絶対に使わない・コミットしない)

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

3. 初回のデプロイで、ゲスト用の利用回数を記録する KV(`QUOTA`)が自動で作られます
4. 表示された `https://freelance-interview-questions.<サブドメイン>.workers.dev` を控える

## 3. フロントエンド

[config.js](config.js) の設定を埋めて push します。

```js
var CONFIG = { SUPABASE_URL: 'https://xxxx.supabase.co', SUPABASE_ANON_KEY: '(anonキー)', WORKER_URL: 'https://....workers.dev' };
```

## 費用と上限

- 利用回数の上限は、ゲストが [worker/src/index.js](worker/src/index.js) の `GUEST_PER_IP_LIMIT`(9回)・`GUEST_GLOBAL_LIMIT`(60回)、ログインユーザーが [supabase/schema.sql](supabase/schema.sql) の `consume_quota` 内(1人15回・全体100回)にあります。日本時間で日次集計し、作成するものを1つ選ぶごとに1回消費します。
- 1回(出力1つ)あたりの目安は約2〜4円(claude-sonnet-5)です。上限をすべて使い切った場合でも、1日あたり最大で約600円です。
- あわせて、Anthropic Console 側で月の利用上限(Spend limit)を設定しておくことを推奨します。

## Supabase無料プランの注意

- 無料プランのプロジェクトは、約1週間アクセスがないと**自動で一時停止**されます。停止中はログイン・保存・ログインユーザーの作成がすべて使えません。ダッシュボードで「Restore project」を押すと復旧します。常時使う場合は有料プランをご検討ください。
- 標準のメール送信は回数制限が厳しいため、利用者が増える場合は Authentication → SMTP Settings で独自SMTPを設定してください。

## 個人情報の扱い

- プロフィールと職務経歴書は、ログインした場合のみ保存されます。テーブルとファイル保管領域は行レベルセキュリティで保護され、本人以外は読み書きできません。
- ゲストが入力した内容は保存されません。ゲストの利用回数の記録には、IPをハッシュ化した値のみを使い、2日で自動的に消えます。
- 案件内容と経歴は、生成のため Anthropic の API に送信されます(画面下部に注記済み)。公開範囲を広げる場合は、プライバシーポリシーなどの整備を検討してください。
- 利用者は、マイページから保存したプロフィールとファイルをいつでも削除できます。アカウント自体の削除は Supabase の管理画面(Authentication → Users)から行います。なお、アカウントを削除してもファイル保管領域の原本は自動では消えないため、先にマイページで削除してください。
