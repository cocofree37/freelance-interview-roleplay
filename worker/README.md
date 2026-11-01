# バックエンド(Cloudflare Worker)

案件のURL(またはテキスト)から、応募文・面談資料・ヒアリングテキストのうち選ばれたものを、Claude APIで作成します。
ゲストとログインユーザーの両方を受け付けます。デプロイ手順は [SETUP.md](../SETUP.md) を参照してください。

## API

`POST /`

| フィールド | 内容 |
|---|---|
| `outputs` | 作成するもの。`proposal`(応募文)/ `interview`(面談資料)/ `hearing`(ヒアリングテキスト)のうち1つ以上 |
| `input` | 案件のURL または テキスト。URLの場合はWorkerが本文を取得する |
| `guest_text` | (ゲストのみ)その場で入力されたプロフィール・経歴。保存されない |
| `form_items` | (応募文のみ・任意)応募フォームの項目 `[{ label, limit }]`。最大10件。`limit` は文字数の上限(無ければ0) |
| `answers` | (任意)前回の「確認したいこと」への回答 `[{ question, answer }]`。最大5件 |
| `feedback` | (任意)前回の出力への修正の指示(600字まで) |

ヘッダー `Authorization: Bearer <Supabaseのアクセストークン>` があればログインユーザー、なければゲストとして扱います。

処理の順序: 本人確認と保存済みプロフィール・ファイルの読み込み(ログイン時)→ URLの本文取得 → 利用回数の消費 → Claude呼び出し。
URLを取得できなかった場合は、回数を消費しません。

レスポンス: `{ outputs, assessment, confirmations, quota }`

- `assessment`: 案件の見立て `{ verdict, summary, strengths, concerns }`(常に付く)
- `confirmations`: 確認したいこと `[{ question, why, until_then }]`(最大5件。常に付く)
- `outputs.proposal`: `{ answers: [{ label, text }] }`(項目ごとの回答。`form_items` が無ければ1件)
- `outputs.interview`: `{ categories, gaps, scripts }`
- `outputs.hearing`: `{ ask, talk }`

`answers` や `feedback` を付けて同じ案件で呼び直すと、それらを反映して作り直します(利用回数は、選んだ出力の数だけ、あらためて消費します)。

## 利用回数

| 対象 | 管理場所 | 上限(1日・日本時間) |
|---|---|---|
| ゲスト(回線ごと) | Cloudflare KV(`QUOTA`)。IPはハッシュ化して保存し、2日で消える | 9回 |
| ゲスト(全体) | 同上 | 60回 |
| ログインユーザー(1人) | Supabase の `consume_quota` | 15回 |
| ログインユーザー(全体) | 同上 | 100回 |

作成するものを1つ選ぶごとに1回消費します。

## 設定

| 種別 | 名前 | 設定場所 |
|---|---|---|
| シークレット | `ANTHROPIC_API_KEY` | `wrangler secret put ANTHROPIC_API_KEY` |
| 変数 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` | [wrangler.toml](wrangler.toml) |
| KV | `QUOTA` | [wrangler.toml](wrangler.toml)(初回の `wrangler deploy` で自動作成) |

CORSは `src/index.js` の `ALLOWED_ORIGIN`(`https://cocofree37.github.io`)のみ許可しています。
