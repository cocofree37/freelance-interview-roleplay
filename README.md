# フリーランス・複業案件 面談官ロールプレイ

フリーランス・複業案件の模擬面談をAIと practice するためのプロンプト一式です。

**アプリはこちら → https://cocofree37.github.io/freelance-interview-roleplay/**

## 構成

- [PROMPT.md](PROMPT.md) — Claude などのAIに読み込ませる面談官ロールプレイのシステムプロンプト
- [index.html](index.html)(= `interview_setup_form.html`) — 面談前のヒアリング項目(案件内容/形態/自分のレベル/面談官タイプ/難易度/重点ポイント)をブラウザで入力するための単体HTMLフォーム。GitHub Pagesの公開ページ本体。

## 使い方

1. `PROMPT.md` の内容をAIチャット(Claude、ChatGPTなど)のシステムプロンプト、またはカスタムインストラクションとして設定する
2. 上記アプリのURL(またはローカルの `index.html`)をブラウザで開き、案件情報や自分のレベルを入力する
3. フォームの出力テキストをAIに貼り付けて模擬面談を開始する
4. 「終了」「フィードバックください」と伝えると、面談官ロールを外れてフィードバックを受け取れる
