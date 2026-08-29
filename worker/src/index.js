const ALLOWED_ORIGIN = 'https://cocofree37.github.io';
const MODEL = 'claude-sonnet-5';
const MAX_INPUT_CHARS = 6000;

const QUESTION_SCHEMA = {
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
    }
  },
  required: ['categories']
};

const SYSTEM_PROMPT = `あなたはフリーランス・複業案件の採用面談を数多く実施してきたベテラン面談官です。
渡された募集内容(案件内容)を読み、実際の面談で聞かれそうな質問を作成してください。

出力は次の7フェーズに沿って、フェーズごとに3〜5個の質問と、1〜3個の準備アドバイスを日本語で作成してください。
1. アイスブレイク・自己紹介
2. 案件要件のすり合わせ
3. 実績・スキルの深掘り
4. 稼働条件
5. 単価・契約条件
6. リスク耐性・トラブル対応
7. クロージング・逆質問

必ず渡された案件内容の具体的な要素(業務内容、必要スキル、稼働形態、報酬条件など読み取れる情報)に言及した、
一般論ではない質問を含めてください。案件内容から読み取れない項目は無理に触れなくてよいです。`;

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

async function callClaude(jobText, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: '案件内容:\n' + jobText }],
      tools: [{ name: 'output_questions', description: '想定質問と準備アドバイスを構造化して出力する', input_schema: QUESTION_SCHEMA }],
      tool_choice: { type: 'tool', name: 'output_questions' }
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

      const result = await callClaude(jobText, env.ANTHROPIC_API_KEY);
      return jsonResponse(result, 200, origin);
    } catch (e) {
      return jsonResponse({ error: e.message || String(e) }, 500, origin);
    }
  }
};
