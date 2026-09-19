# バックエンド(Cloudflare Worker)

ログイン済みユーザーのリクエストを受け、Claude APIで「応募提案文」または「面談の想定質問」を生成します。
デプロイ手順は、リポジトリ直下の [SETUP.md](../SETUP.md) を参照してください。

## API

`POST /` (ヘッダー `Authorization: Bearer <Supabaseのアクセストークン>`)

| フィールド | 内容 |
|---|---|
| `mode` | `proposal`(応募提案文)/ `questions`(面談の想定質問) |
| `input` | 案件のURL または テキスト。URLの場合はWorkerが本文を取得する |
| `answers` | (proposalのみ)追加質問への回答 `[{question, answer}]` |

処理の流れ: Supabaseで本人確認と経歴の取得 → 利用回数の消費(上限超過は429)→ (URLなら)本文取得 → Claude呼び出し

- `questions`: `{ categories, gaps, quota }`(gaps = 経歴と案件のギャップから突っ込まれそうな点)
- `proposal` の1回目: 情報が足りなければ `{ status: 'need_info', questions }`(最大3問)、十分なら `{ status: 'done', proposal }`
- `proposal` に `answers` を付けた2回目: 必ず `{ status: 'done', proposal }`

## 設定

| 種別 | 名前 | 設定場所 |
|---|---|---|
| シークレット | `ANTHROPIC_API_KEY` | `wrangler secret put ANTHROPIC_API_KEY` |
| 変数 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` | [wrangler.toml](wrangler.toml) |

CORSは `src/index.js` の `ALLOWED_ORIGIN`(`https://cocofree37.github.io`)のみ許可しています。
