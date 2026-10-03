import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpPost } from '../src/worker.js';
import { getUsdRates } from '../src/rates.js';

const fakeRates = async () => ({ rates: { USD: 1, EUR: 0.889, INR: 96.37 }, updated: '2026-10-02T00:00:00.000Z', source: 'test' });
const post = (body, rates = fakeRates) =>
    handleMcpPost(new Request('https://x/mcp', { method: 'POST', body: JSON.stringify(body) }), rates);

test('falls back to the second rate feed when the first fails', async () => {
    const result = await getUsdRates([async () => { throw new Error('down'); }, fakeRates]);
    assert.equal(result.source, 'test');
});

test('reports both feed failures when neither works', async () => {
    const failing = async () => { throw new Error('down'); };
    await assert.rejects(getUsdRates([failing, failing]), /Both rate feeds are unavailable/);
});

test('tool call returns readable text plus the card data', async () => {
    const reply = await (await post({ jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'convert_currency', arguments: { amount: 100, from: 'USD', to: ['INR'] } } })).json();
    assert.match(reply.result.content[0].text, /100\.00 USD = 9,637\.00 INR/);
    assert.equal(reply.result.structuredContent.results[0].code, 'INR');
    assert.equal(reply.result._meta.ui.resourceUri, 'ui://currensor/card.html');
});

test('a bad currency comes back as a tool error the model can read, not a crash', async () => {
    const reply = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'convert_currency', arguments: { from: 'USD', to: ['ZZZ'] } } })).json();
    assert.equal(reply.result.isError, true);
    assert.match(reply.result.content[0].text, /Unknown currency: ZZZ/);
});

test('notifications are accepted with no reply body', async () => {
    const response = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(response.status, 202);
});

test('the card is served as an MCP Apps resource', async () => {
    const reply = await (await post({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'ui://currensor/card.html' } })).json();
    assert.equal(reply.result.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.match(reply.result.contents[0].text, /ui\/initialize/);
});

test('every tool result carries each field its declared output schema requires', async () => {
    const list = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).json();
    const schema = list.result.tools[0].outputSchema;
    const reply = await (await post({ jsonrpc: '2.0', id: 5, method: 'tools/call',
        params: { name: 'convert_currency', arguments: { amount: 5, from: 'EUR', to: ['USD', 'INR'] } } })).json();
    const data = reply.result.structuredContent;
    for (const field of schema.required) assert.ok(field in data, `missing ${field}`);
    for (const row of data.results) {
        for (const field of schema.properties.results.items.required) assert.ok(field in row, `row missing ${field}`);
    }
});

test('connections and successful conversions are reported for counting, failures are not', async () => {
    const seen = [];
    const send = body => handleMcpPost(new Request('https://x/mcp', { method: 'POST', body: JSON.stringify(body) }), fakeRates, u => seen.push(u));
    await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    await send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'convert_currency', arguments: { from: 'usd', to: ['inr'] } } });
    await send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'convert_currency', arguments: { from: 'USD', to: ['ZZZ'] } } });
    assert.deepEqual(seen, [{ event: 'connect' }, { event: 'convert', from: 'USD', to: ['INR'] }]);
});
