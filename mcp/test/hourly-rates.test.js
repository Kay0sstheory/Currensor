import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenExchangeRates, refreshStoredRates, readRates, MAX_AGE_MS } from '../src/hourly-rates.js';

const publishedAt = Date.UTC(2026, 9, 5, 15, 0, 0);
const hourlyFeed = { timestamp: publishedAt / 1000, base: 'USD', rates: { USD: 1, CAD: 1.42, EUR: 0.889 } };
const dailyRates = { rates: { USD: 1, CAD: 1.41 }, updated: '2026-10-05T00:00:00.000Z', source: 'open.er-api.com' };

function memoryStore(initial = null) {
    let saved = initial === null ? null : JSON.stringify(initial);
    return {
        async get() { return saved; },
        async put(_key, value) { saved = value; },
        peek() { return saved === null ? null : JSON.parse(saved); },
    };
}

test('reads the hourly feed into rates with its publish time', () => {
    const parsed = parseOpenExchangeRates(hourlyFeed);
    assert.equal(parsed.rates.CAD, 1.42);
    assert.equal(parsed.updated, '2026-10-05T15:00:00.000Z');
    assert.equal(parsed.source, 'openexchangerates.org');
});

test('rejects an hourly feed that is not priced in US dollars', () => {
    assert.throws(() => parseOpenExchangeRates({ ...hourlyFeed, base: 'EUR' }), /USD/);
});

test('rejects an hourly feed with missing or non-positive rates', () => {
    assert.throws(() => parseOpenExchangeRates({ ...hourlyFeed, rates: {} }), /rates/);
    assert.throws(() => parseOpenExchangeRates({ ...hourlyFeed, rates: { USD: 1, CAD: 0 } }), /CAD/);
});

test('saves fresh hourly rates on each scheduled refresh', async () => {
    const store = memoryStore();
    await refreshStoredRates({ fetchHourly: async () => hourlyFeed, store });
    assert.equal(store.peek().rates.CAD, 1.42);
});

test('keeps the last good rates when the hourly feed fails', async () => {
    const store = memoryStore(parseOpenExchangeRates(hourlyFeed));
    await assert.rejects(refreshStoredRates({ fetchHourly: async () => { throw new Error('feed down'); }, store }), /feed down/);
    assert.equal(store.peek().rates.CAD, 1.42);
});

test('serves stored rates while they are recent', async () => {
    const store = memoryStore(parseOpenExchangeRates(hourlyFeed));
    const result = await readRates({ store, now: publishedAt + 60 * 60 * 1000, fallback: async () => dailyRates });
    assert.equal(result.rates.CAD, 1.42);
});

test('falls back to the daily feeds when stored rates are too old', async () => {
    const store = memoryStore(parseOpenExchangeRates(hourlyFeed));
    const result = await readRates({ store, now: publishedAt + MAX_AGE_MS + 1, fallback: async () => dailyRates });
    assert.equal(result.rates.CAD, 1.41);
});

test('falls back to the daily feeds when nothing has been stored yet', async () => {
    const result = await readRates({ store: memoryStore(), now: publishedAt, fallback: async () => dailyRates });
    assert.equal(result.source, 'open.er-api.com');
});
