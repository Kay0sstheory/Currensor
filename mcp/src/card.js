// The in-chat card. Works in hosts that speak MCP Apps (Claude, ChatGPT) and in
// ChatGPT's older window.openai bridge. Rates arrive with the tool result, so
// retyping the amount recalculates instantly without another tool call.
export const CARD_URI = 'ui://currensor/card.html';
export const CARD_MIME = 'text/html;profile=mcp-app';

export const CARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Currensor</title>
<style>
  :root {
    --accent: #1A6B3C; --bg: #F5F3EF; --card: #FFFFFF; --border: #E2DFD8;
    --text: #1A1A1E; --dim: #8A8780; --input: #EDEAE4;
  }
  :root[data-theme="dark"] {
    --accent: #E8FF59; --bg: #0D0D0F; --card: #17171B; --border: #2A2A30;
    --text: #E8E8EC; --dim: #7A7A85; --input: #222228;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent; }
  body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--text); }
  .card { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 16px; max-width: 560px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .brand { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
  .brand span { color: var(--accent); }
  .stamp { font-size: 11px; color: var(--dim); font-family: 'Space Mono', ui-monospace, monospace; }
  .from { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
  .flag { font-size: 22px; line-height: 1; }
  .code { font-weight: 700; font-size: 14px; }
  .name { font-size: 11px; color: var(--dim); }
  .from input { flex: 1; min-width: 0; text-align: right; font: 700 22px 'Space Mono', ui-monospace, monospace; color: var(--text);
    background: var(--input); border: 1px solid transparent; border-radius: 8px; padding: 6px 10px; outline: none; }
  .from input:focus { border-color: var(--accent); }
  .rows { margin-top: 8px; display: grid; gap: 6px; }
  .row { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
  .row .label { flex: 1; min-width: 0; }
  .value { text-align: right; }
  .value .big { font: 700 18px 'Space Mono', ui-monospace, monospace; }
  .value .rate { font-size: 11px; color: var(--dim); font-family: 'Space Mono', ui-monospace, monospace; }
  .empty { color: var(--dim); font-size: 13px; padding: 12px 4px; }
</style>
</head>
<body>
<div class="card" id="card">
  <div class="head"><div class="brand">Curren<span>$</span>or</div><div class="stamp" id="stamp"></div></div>
  <div id="content"><div class="empty">Waiting for rates…</div></div>
</div>
<script>
(function () {
  var state = null;
  var nextId = 1;

  function digitsFor(code) { return state && state.zeroDecimal.indexOf(code) >= 0 ? 0 : 2; }
  function format(value, code) {
    var d = digitsFor(code);
    return value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function formatRate(rate) {
    return rate >= 100 ? rate.toFixed(2) : rate >= 1 ? rate.toFixed(4) : rate.toPrecision(4);
  }
  function escape(text) {
    return String(text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function render() {
    if (!state) return;
    var rows = state.results.map(function (r) {
      return '<div class="row"><div class="flag">' + r.flag + '</div><div class="label"><div class="code">' + escape(r.code) +
        '</div><div class="name">' + escape(r.name) + '</div></div><div class="value"><div class="big" data-code="' + escape(r.code) + '">' +
        format(state.amount * r.rate, r.code) + '</div><div class="rate">1 ' + escape(state.from) + ' = ' + formatRate(r.rate) + '</div></div></div>';
    }).join('');
    document.getElementById('content').innerHTML =
      '<div class="from"><div class="flag">' + state.fromFlag + '</div><div><div class="code">' + escape(state.from) +
      '</div><div class="name">' + escape(state.fromName) + '</div></div><input id="amount" inputmode="decimal" aria-label="Amount" value="' +
      escape(state.amount) + '"></div><div class="rows">' + rows + '</div>';
    if (state.updated) {
      document.getElementById('stamp').textContent = 'Rates ' + new Date(state.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    document.getElementById('amount').addEventListener('input', onAmountTyped);
    reportSize();
  }

  function onAmountTyped(event) {
    var amount = parseFloat(event.target.value.replace(/,/g, ''));
    if (!isFinite(amount) || amount < 0) amount = 0;
    state.amount = amount;
    state.results.forEach(function (r) {
      var cell = document.querySelector('.big[data-code="' + r.code + '"]');
      if (cell) cell.textContent = format(amount * r.rate, r.code);
    });
  }

  function accept(data) {
    if (!data || !data.results) return;
    state = data;
    render();
  }

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
  }

  // ── MCP Apps bridge ──
  function send(message) { window.parent.postMessage(message, '*'); }
  function request(method, params) { var id = nextId++; send({ jsonrpc: '2.0', id: id, method: method, params: params }); return id; }
  function notify(method, params) { send({ jsonrpc: '2.0', method: method, params: params || {} }); }

  function reportSize() {
    var card = document.getElementById('card');
    notify('ui/notifications/size-changed', { width: Math.ceil(card.scrollWidth), height: Math.ceil(document.body.scrollHeight) });
  }

  var initId = null;
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    if (message.id === initId && message.result) {
      var context = message.result.hostContext || {};
      applyTheme(context.theme);
      notify('ui/notifications/initialized');
      return;
    }
    if (message.method === 'ui/notifications/tool-result') {
      accept(message.params && message.params.structuredContent);
    } else if (message.method === 'ui/notifications/host-context-changed') {
      applyTheme(message.params && message.params.theme);
    } else if (message.method === 'ui/resource-teardown' && message.id !== undefined) {
      send({ jsonrpc: '2.0', id: message.id, result: {} });
    }
  });

  // ── ChatGPT window.openai bridge (older hosts) ──
  function readOpenAi() {
    if (!window.openai) return;
    applyTheme(window.openai.theme);
    accept(window.openai.toolOutput);
  }
  window.addEventListener('openai:set_globals', readOpenAi);
  readOpenAi();

  initId = request('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'Currensor', version: '1.0.0' },
    appCapabilities: { availableDisplayModes: ['inline'] }
  });
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
})();
</script>
</body>
</html>`;
