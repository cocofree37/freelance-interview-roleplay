const ALLOWED_ORIGIN = 'https://cocofree37.github.io';
const MODEL = 'claude-sonnet-5';
const MAX_INPUT_CHARS = 6000;
const MAX_PROFILE_CHARS = 4000;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '面談フェーズ名(例: 案件要件のすり合わせ)' },
          questions: { type: 'array', items: { type: 'string' }, description: 'この案件内容を踏まえた、面談で聞かれそうな具体的な質問' },
          tips: { type: 'array', items: { type: 'string' }, description: 'このフェーズで事前に準備しておくとよいこと' }
        },
        required: ['title', 'questions', 'tips']
      }
    },
    proposal: {
      type: 'string',
      description: 'クライアントに送る案件提案文(応募文章)。挨拶/課題理解/実績提示/解決策/期待成果/クロージングの構成を持つ、そのまま送れる完成した文章。'
    }
  },
  required: ['categories', 'proposal']
};

const SYSTEM_PROMPT = `あなたはフリーランス・複業案件のベテラン面談官であり、また案件提案文(応募文章)を数多く手がけてきたプロのライターでもあります。
渡された「案件内容」と、応募者本人の「実績・経歴」を読み、次の2つを日本語で作成してください。

## 1. 想定される面談質問(categories)
実際の面談で聞かれそうな質問を、次の7フェーズに沿って作成する。フェーズごとに3〜5個の質問と、1〜3個の準備アドバイスを含める。
1. アイスブレイク・自己紹介
2. 案件要件のすり合わせ
3. 実績・スキルの深掘り
4. 稼働条件
5. 単価・契約条件
6. リスク耐性・トラブル対応
7. クロージング・逆質問
必ず渡された案件内容の具体的な要素(業務内容、必要スキル、稼働形態、報酬条件など読み取れる情報)に言及した、一般論ではない質問を含めること。案件内容から読み取れない項目は無理に触れなくてよい。

## 2. 案件提案文(proposal)
クライアントの募集(案件内容)に対する提案文を、応募者の「実績・経歴」に基づいて作成する。

構成は次の順とする。
1. 挨拶と感謝の言葉
2. クライアントの課題の理解を示すセクション(案件内容から読み取れる課題・ニーズへの言及)
3. 応募者の関連する実績・専門知識の提示(「実績・経歴」に実際に書かれている情報のみを使う。数値や成果が書かれていればそのまま活用する)
4. 案件に対する具体的な解決策と実施の進め方(ステップバイステップ)
5. 期待される成果と付加価値
6. 次のステップの提案と結びの言葉

ルール:
- トーンはプロフェッショナルかつ信頼感があり、案件への熱意と自信が伝わるものにする。簡潔で明確な表現とし、曖昧な言い回しは避ける。
- 「実績・経歴」に書かれていない実績・数値・スキルを創作しない。情報が不足している箇所は、一般的な強み(丁寧な対応、迅速なコミュニケーションなど)で補うか、「[具体的な実績を記入してください]」のようなプレースホルダーを使う。
- 「実績・経歴」が空欄の場合でも、案件内容だけを根拠にした提案文のテンプレートを作成し、実績を書く欄には上記のプレースホルダーを入れる。
- 文中で専門用語を使う場合は、案件内容や実績・経歴に登場する範囲の言葉を使い、案件と無関係な分野の用語は使わない。`;

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

class TextCollector {
  constructor() { this.text = ''; }
  text(chunk) { this.text += chunk.text; }
}

async function fetchUrlAsText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InterviewPrepBot/1.0)' },
    cf: { cacheTtl: 0 }
  });
  if (!res.ok) throw new Error('URLの取得に失敗しました (status ' + res.status + ')');

  const collector = new TextCollector();
  const rewriter = new HTMLRewriter()
    .on('script', { element(el) { el.remove(); } })
    .on('style', { element(el) { el.remove(); } })
    .on('noscript', { element(el) { el.remove(); } })
    .on('body', collector);

  const transformed = rewriter.transform(res);
  await transformed.arrayBuffer();

  return collector.text.replace(/\s+/g, ' ').trim();
}

async function callClaude(jobText, profileText, apiKey) {
  const userContent = '案件内容:\n' + jobText
    + '\n\n---\n応募者の実績・経歴:\n' + (profileText ? profileText : '(未入力。案件内容のみを根拠にテンプレートを作成してください)');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      tools: [{ name: 'output_result', description: '想定質問と案件提案文を構造化して出力する', input_schema: OUTPUT_SCHEMA }],
      tool_choice: { type: 'tool', name: 'output_result' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Claude API error: ' + res.status + ' ' + errText);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find(function(b) { return b.type === 'tool_use'; });
  if (!toolUse) throw new Error('Claude からの構造化出力が取得できませんでした');
  return toolUse.input;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: '不正なリクエストです' }, 400, origin);
    }

    const input = (body.input || '').toString().trim();
    const profile = (body.profile || '').toString().trim().slice(0, MAX_PROFILE_CHARS);
    if (!input) {
      return jsonResponse({ error: '案件内容が空です' }, 400, origin);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'サーバー側にANTHROPIC_API_KEYが設定されていません' }, 500, origin);
    }

    try {
      let jobText = input;
      const isUrl = /^https?:\/\//i.test(input);
      if (isUrl) {
        jobText = await fetchUrlAsText(input);
        if (!jobText) throw new Error('URLから本文を取得できませんでした');
      }
      jobText = jobText.slice(0, MAX_INPUT_CHARS);

      const result = await callClaude(jobText, profile, env.ANTHROPIC_API_KEY);
      return jsonResponse(result, 200, origin);
    } catch (e) {
      return jsonResponse({ error: e.message || String(e) }, 500, origin);
    }
  }
};
