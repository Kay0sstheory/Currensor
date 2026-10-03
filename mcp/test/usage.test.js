import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientFromUserAgent, recordUsage } from '../src/usage.js';

function fakeDatabase() {
    const runs = [];
    return {
        runs,
        prepare(sql) {
            return { bind: (...values) => ({ run: async () => { runs.push({ sql, values }); } }) };
        },
    };
}

test('recognises Claude and ChatGPT from their user agents and buckets the rest', () => {
    assert.equal(clientFromUserAgent('Claude-User (claude-code/2.0; +https://www.anthropic.com)'), 'claude');
    assert.equal(clientFromUserAgent('openai-mcp/1.0.0'), 'chatgpt');
    assert.equal(clientFromUserAgent('node'), 'other');
    assert.equal(clientFromUserAgent(null), 'other');
});

test('a conversion adds one to that day, app and currency pair', async () => {
    const database = fakeDatabase();
    await recordUsage(database, { client: 'claude', event: 'convert', from: 'CAD', to: ['INR', 'EUR'], when: new Date('2026-10-03T05:00:00Z') });
    assert.equal(database.runs.length, 2);
    assert.match(database.runs[0].sql, /ON CONFLICT .* DO UPDATE SET count = count \+ 1/s);
    assert.deepEqual(database.runs[0].values, ['2026-10-03', 'claude', 'convert', 'CAD>INR']);
    assert.deepEqual(database.runs[1].values, ['2026-10-03', 'claude', 'convert', 'CAD>EUR']);
});

test('a connection is counted without a currency pair', async () => {
    const database = fakeDatabase();
    await recordUsage(database, { client: 'chatgpt', event: 'connect', when: new Date('2026-10-03T05:00:00Z') });
    assert.deepEqual(database.runs[0].values, ['2026-10-03', 'chatgpt', 'connect', '']);
});

test('a missing or failing database never breaks a conversion', async () => {
    await recordUsage(undefined, { client: 'claude', event: 'connect' });
    const broken = { prepare() { throw new Error('database down'); } };
    await recordUsage(broken, { client: 'claude', event: 'connect' });
});
