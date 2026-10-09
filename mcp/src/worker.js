// Currensor MCP server: one stateless endpoint (/mcp) that Claude and ChatGPT both connect to.
import { convert, formatAmount } from './convert.js';
import { getUsdRates } from './rates.js';
import { CARD_HTML, CARD_MIME, CARD_URI } from './card.js';
import { clientFromUserAgent, recordUsage } from './usage.js';

const SUPPORTED_PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const PUBLIC_ORIGIN = 'https://currensor-mcp.currensor-mcp.workers.dev';
const SERVER_INFO = {
    name: 'currensor',
    title: 'Currensor',
    version: '1.0.0',
    websiteUrl: 'https://github.com/Kay0sstheory/Currensor',
    icons: [{ src: `${PUBLIC_ORIGIN}/icon.png`, mimeType: 'image/png', sizes: ['512x512'] }],
};

const CARD_LINK = {
    ui: { resourceUri: CARD_URI },
    'openai/outputTemplate': CARD_URI,
    'openai/toolInvocation/invoking': 'Checking live rates…',
    'openai/toolInvocation/invoked': 'Rates ready',
};

const TOOLS = [
    {
        name: 'convert_currency',
        title: 'Convert currency',
        description:
            'Convert an amount from one currency into one or more others at live market rates, shown as an interactive card. ' +
            'Use ISO 4217 codes (USD, EUR, INR, JPY…). Covers 166 currencies, refreshed hourly.',
        inputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', minimum: 0, description: 'Amount in the source currency. Defaults to 1.' },
                from: { type: 'string', description: 'Source currency code, e.g. "USD".' },
                to: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 12,
                    description: 'Target currency codes, e.g. ["EUR", "INR"].',
                },
            },
            required: ['from', 'to'],
        },
        outputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: 'The amount converted.' },
                from: { type: 'string', description: 'Source currency code.' },
                fromName: { type: 'string' },
                fromFlag: { type: 'string' },
                zeroDecimal: { type: 'array', items: { type: 'string' }, description: 'Codes shown without decimals.' },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            code: { type: 'string' },
                            name: { type: 'string' },
                            flag: { type: 'string' },
                            rate: { type: 'number', description: 'Units of this currency per 1 unit of the source.' },
                            value: { type: 'number' },
                            display: { type: 'string', description: 'Value formatted for reading.' },
                        },
                        required: ['code', 'name', 'flag', 'rate', 'value', 'display'],
                    },
                },
                updated: { type: 'string', description: 'When the rates were published (ISO 8601).' },
                source: { type: 'string', description: 'Which rate feed answered.' },
            },
            required: ['amount', 'from', 'fromName', 'fromFlag', 'zeroDecimal', 'results', 'updated', 'source'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true },
        _meta: CARD_LINK,
    },
];

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

function rpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function summaryText(conversion, updated) {
    const lines = conversion.results.map(
        r => `${formatAmount(conversion.amount, conversion.from)} ${conversion.from} = ${r.display} ${r.code}`,
    );
    return `${lines.join('\n')}\n(Mid-market rates as of ${updated.slice(0, 10)}. The user already sees these figures on an interactive card, so add context rather than repeating them.)`;
}

async function callConvert(args, rateSource) {
    let rates;
    try {
        rates = await rateSource();
    } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
    try {
        const conversion = convert(args || {}, rates.rates);
        return {
            content: [{ type: 'text', text: summaryText(conversion, rates.updated) }],
            structuredContent: { ...conversion, updated: rates.updated, source: rates.source },
            _meta: CARD_LINK,
        };
    } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
}

async function handleMessage(message, rateSource) {
    const { id, method, params } = message;
    switch (method) {
        case 'initialize': {
            const requested = params?.protocolVersion;
            return {
                protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
                capabilities: {
                    tools: {},
                    resources: {},
                    extensions: { 'io.modelcontextprotocol/ui': {} },
                },
                serverInfo: SERVER_INFO,
                instructions: 'Use convert_currency whenever the user asks about exchange rates or converting money between currencies.',
            };
        }
        case 'ping':
            return {};
        case 'tools/list':
            return { tools: TOOLS };
        case 'tools/call':
            if (params?.name !== 'convert_currency') throw { code: -32602, message: `Unknown tool: ${params?.name}` };
            return callConvert(params.arguments, rateSource);
        case 'resources/list':
            return { resources: [{ uri: CARD_URI, name: 'Currensor card', mimeType: CARD_MIME }] };
        case 'resources/templates/list':
            return { resourceTemplates: [] };
        case 'resources/read':
            if (params?.uri !== CARD_URI) throw { code: -32602, message: `Unknown resource: ${params?.uri}` };
            return {
                contents: [
                    {
                        uri: CARD_URI,
                        mimeType: CARD_MIME,
                        text: CARD_HTML,
                        _meta: {
                            ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } },
                            'openai/widgetPrefersBorder': false,
                            // ChatGPT gives the card its own sandbox origin from this; required for directory submission.
                            'openai/widgetDomain': PUBLIC_ORIGIN,
                            // The card loads nothing from outside; declaring that turns ChatGPT's sandbox rules on.
                            'openai/widgetCSP': { connect_domains: [], resource_domains: [] },
                            'openai/widgetDescription': 'Live currency conversion card with an editable amount.',
                        },
                    },
                ],
            };
        case 'prompts/list':
            return { prompts: [] };
        default:
            throw { code: -32601, message: `Method not found: ${method}` };
    }
}

async function respondTo(message, rateSource) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        // Responses from the client to server requests carry no method; we never send any, so ignore them.
        return message && message.method === undefined && message.id !== undefined ? null : rpcError(message?.id, -32600, 'Invalid request');
    }
    if (message.id === undefined) return null; // notifications get no reply
    try {
        return { jsonrpc: '2.0', id: message.id, result: await handleMessage(message, rateSource) };
    } catch (error) {
        return rpcError(message.id, error.code ?? -32603, error.message ?? 'Internal error');
    }
}

// Pair each incoming message with its reply and report the ones worth counting.
function usageEvents(messages, replies) {
    const events = [];
    messages.forEach((message, index) => {
        const result = replies[index]?.result;
        if (message?.method === 'initialize' && result) events.push({ event: 'connect' });
        if (message?.method === 'tools/call' && result?.structuredContent) {
            const { from, results } = result.structuredContent;
            events.push({ event: 'convert', from, to: results.map(r => r.code) });
        }
    });
    return events;
}

export async function handleMcpPost(request, rateSource = getUsdRates, onUsage = () => {}) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json(rpcError(null, -32700, 'Parse error'), 400);
    }
    const isBatch = Array.isArray(body);
    const messages = isBatch ? body : [body];
    const allReplies = await Promise.all(messages.map(m => respondTo(m, rateSource)));
    for (const usage of usageEvents(messages, allReplies)) onUsage(usage);
    const replies = allReplies.filter(Boolean);
    if (replies.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return json(isBatch ? replies : replies[0]);
}

const LANDING_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Currensor connector</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0f1115;color:#e8e8e8;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:34rem;padding:2rem 1rem;line-height:1.55}
h1{font-size:1.6rem;margin:0 0 .5rem}
a.button{display:inline-block;margin:1rem 0;padding:.8rem 1.4rem;border-radius:8px;background:#2f9e6f;color:#fff;text-decoration:none;font-weight:600}
code{background:#1d2129;padding:.15rem .4rem;border-radius:4px;word-break:break-all}
ol{padding-left:1.2rem}
.muted{color:#9aa0a6;font-size:.9rem}
</style></head><body><main>
<h1>Curren$or</h1>
<p>This address is Currensor's connector for AI chats. It works when you paste it into Claude or ChatGPT, not when you open it in a browser.</p>
<a class="button" href="https://kay0sstheory.github.io/Currensor/">Try the web version</a>
<p><strong>Use it inside Claude:</strong></p>
<ol>
<li>Open Settings → Connectors → Add custom connector.</li>
<li>Paste <code>https://currensor-mcp.currensor-mcp.workers.dev/mcp</code></li>
<li>Ask something like "What's 250 CAD in rupees, euros and yen?"</li>
</ol>
<p class="muted">Free and open source · <a href="https://github.com/Kay0sstheory/Currensor" style="color:#9aa0a6">Code on GitHub</a></p>
</main></body></html>
`;

// Browsers ask for HTML; AI apps ask for JSON or an event stream.
function wantsWebPage(request) {
    return request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html');
}

function landingPage() {
    return new Response(LANDING_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export default {
    async fetch(request, env, context) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        if (url.pathname === '/mcp') {
            if (request.method === 'POST') {
                const client = clientFromUserAgent(request.headers.get('User-Agent'));
                return handleMcpPost(request, getUsdRates, usage =>
                    context.waitUntil(recordUsage(env.USAGE, { client, ...usage })),
                );
            }
            // People click this address in posts; give them a way in instead of an error.
            if (wantsWebPage(request)) return landingPage();
            // Stateless server: no server-initiated stream and no session to end.
            return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', ...CORS_HEADERS } });
        }
        if (url.pathname === '/.well-known/openai-apps-challenge') {
            // OpenAI's domain check: the token from the plugin dashboard, set in wrangler.toml [vars].
            if (!env.OPENAI_APPS_CHALLENGE) return new Response('Not found', { status: 404 });
            return new Response(env.OPENAI_APPS_CHALLENGE, { headers: { 'Content-Type': 'text/plain' } });
        }
        if (url.pathname === '/') {
            if (wantsWebPage(request)) return landingPage();
            return new Response('Currensor MCP server. Connect your AI app to /mcp.\nhttps://github.com/Kay0sstheory/Currensor\n', {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }
        return new Response('Not found', { status: 404 });
    },
};
