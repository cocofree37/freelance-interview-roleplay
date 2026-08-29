# バックエンド(Cloudflare Worker)

案件内容(またはURL)をClaude APIに渡し、案件に沿った想定質問を生成するAPIです。
URLが渡された場合はWorker側でページ本文を取得し、その内容をもとに質問を作ります。

## 前提

- Cloudflareアカウント(無料枠で動作します) → https://dash.cloudflare.com/sign-up
- Anthropicの APIキー → https://console.anthropic.com/settings/keys で発行(利用量に応じて課金されます)
- Node.js(インストール済み)

## デプロイ手順

1. wranglerをインストール(このディレクトリで実行)

   ```bash
   cd worker
   npm install -g wrangler
   ```

2. Cloudflareにログイン(ブラウザが開くので、そこで許可してください)

   ```bash
   wrangler login
   ```

3. APIキーをシークレットとして登録(コマンド実行後にプロンプトが出るので、そこに貼り付けてください。ターミナルの履歴やこのファイルにキーを書かないこと)

   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```

4. デプロイ

   ```bash
   wrangler deploy
   ```

   成功すると `https://freelance-interview-questions.<あなたのサブドメイン>.workers.dev` のようなURLが表示されます。

5. 表示されたURLを、リポジトリ直下の `index.html` 内 `var WORKER_URL = '';` に設定して、再度pushしてください
   (このURLを教えてもらえれば、私の方で設定してpushすることもできます)。

## 注意

- `src/index.js` 内の `ALLOWED_ORIGIN` は `https://cocofree37.github.io` に固定しています。別のオリジンから呼び出す場合は変更してください。
- Claude APIの利用料はデプロイ後の利用量に応じて発生します。
