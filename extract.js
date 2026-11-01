// 職務経歴書などのファイルから、ブラウザ内で文字を取り出す共通モジュール。
// ファイルの中身は、ここでは外部に送信されません(部品の読み込みのみCDNを使います)。
(function () {
  var PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
  var MAMMOTH = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_CHARS = 30000;
  var MAX_PDF_PAGES = 40;

  var TYPES = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown'
  };

  var loading = {};

  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () {
          delete loading[src];
          reject(new Error('文字を取り出す部品を読み込めませんでした。通信状況を確認してください'));
        };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  async function readPlain(file) {
    var buf = await file.arrayBuffer();
    var text = new TextDecoder('utf-8').decode(buf);
    if (text.indexOf('�') !== -1) {
      try { text = new TextDecoder('shift_jis').decode(buf); } catch (e) { /* UTF-8のまま */ }
    }
    return text;
  }

  async function readDocx(file) {
    await loadScript(MAMMOTH);
    var r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }

  async function readPdf(file) {
    await loadScript(PDFJS + 'build/pdf.min.js');
    var lib = window.pdfjsLib;
    if (!lib.GlobalWorkerOptions.workerSrc) {
      // 別オリジンのWorkerは直接読み込めないため、取得してBlob経由で渡す
      var code = await (await fetch(PDFJS + 'build/pdf.worker.min.js')).text();
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    }
    var pdf = await lib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: PDFJS + 'cmaps/',
      cMapPacked: true
    }).promise;

    var pages = [];
    var count = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (var i = 1; i <= count; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var line = '';
      content.items.forEach(function (it) { line += it.str + (it.hasEOL ? '\n' : ''); });
      pages.push(line);
    }
    return pages.join('\n');
  }

  function normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t　]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // 戻り値: { text, truncated, ext, mime }。取り出せない場合は、理由を日本語にした Error を投げる。
  async function extract(file) {
    var ext = extOf(file.name);
    if (!TYPES[ext]) throw new Error('「' + file.name + '」は対応していない形式です(PDF・Word(.docx)・テキスト(.txt/.md)のみ)');
    if (file.size > MAX_BYTES) throw new Error('「' + file.name + '」は5MBを超えています');
    if (file.size === 0) throw new Error('「' + file.name + '」は空のファイルです');

    var raw;
    if (ext === 'pdf') raw = await readPdf(file);
    else if (ext === 'docx') raw = await readDocx(file);
    else raw = await readPlain(file);

    var text = normalize(raw);
    if (text.length < 20) {
      throw new Error('「' + file.name + '」から文字を取り出せませんでした。画像だけのPDFは対応していません。文章をコピーして貼り付けてください');
    }
    var truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);
    return { text: text, truncated: truncated, ext: ext, mime: TYPES[ext] };
  }

  window.DocExtract = {
    extract: extract,
    accept: '.pdf,.docx,.txt,.md',
    MAX_BYTES: MAX_BYTES,
    MAX_CHARS: MAX_CHARS
  };
})();
