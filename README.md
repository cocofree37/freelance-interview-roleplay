# フリーランス・複業案件 面談準備アシスト

案件のURLまたはテキストを入力し、次のどちらかを作成するツールです。

- **応募提案文の作成** — 案件と、登録した経歴・実績から提案文の下書きを作成(情報不足ならAIが最大3問質問)
- **面談で想定される質問** — 想定質問と準備事項に加え、経歴と案件のギャップから「突っ込まれそうな点」を提示

**アプリはこちら → https://cocofree37.github.io/freelance-interview-roleplay/**

## 動作モード

| モード | 条件 | 内容 |
|---|---|---|
| 簡易版 | セットアップ前(現状) | ログイン不要。テンプレート+キーワード判定で作成。URLは読み込まず、経歴は保存されない |
| AI版 | [SETUP.md](SETUP.md) 完了後 | メールログイン、経歴のSupabase保存、URL本文の自動取得、Claudeによる生成。1人1日10回・全体1日100回の上限あり |

## 構成

- [index.html](index.html) — フロントエンド(GitHub Pagesの公開ページ本体)
- [worker/](worker/) — Cloudflare Worker(本人確認・利用回数管理・URL取得・Claude呼び出し)。仕様は [worker/README.md](worker/README.md)
- [supabase/schema.sql](supabase/schema.sql) — 経歴テーブル(行レベルセキュリティ付き)と利用回数の管理関数
- [SETUP.md](SETUP.md) — AI版を有効にする手順、費用の目安、個人情報の扱い
- [PROMPT.md](PROMPT.md) — (参考)AIチャットで模擬面談をしてもらう場合のシステムプロンプト
