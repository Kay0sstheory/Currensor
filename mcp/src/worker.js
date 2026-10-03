// Currensor MCP server: one stateless endpoint (/mcp) that Claude and ChatGPT both connect to.
import { convert, formatAmount } from './convert.js';
import { getUsdRates } from './rates.js';
import { CARD_HTML, CARD_MIME, CARD_URI } from './card.js';

const SUPPORTED_PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'currensor', title: 'Currensor', version: '1.0.0' };

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
            'Use ISO 4217 codes (USD, EUR, INR, JPY…). Covers about 160 currencies, refreshed hourly.',
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
        annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
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
    return `${lines.join('\n')}\n(Mid-market rates as of ${updated.slice(0, 10)}.)`;
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

export async function handleMcpPost(request, rateSource = getUsdRates) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json(rpcError(null, -32700, 'Parse error'), 400);
    }
    const isBatch = Array.isArray(body);
    const replies = (await Promise.all((isBatch ? body : [body]).map(m => respondTo(m, rateSource)))).filter(Boolean);
    if (replies.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return json(isBatch ? replies : replies[0]);
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        if (url.pathname === '/mcp') {
            if (request.method === 'POST') return handleMcpPost(request);
            // Stateless server: no server-initiated stream and no session to end.
            return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', ...CORS_HEADERS } });
        }
        if (url.pathname === '/') {
            return new Response('Currensor MCP server. Connect your AI app to /mcp.\nhttps://github.com/Kay0sstheory/Currensor\n', {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }
        return new Response('Not found', { status: 404 });
    },
};
