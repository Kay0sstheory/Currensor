import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/convert.js';

const usdRates = { USD: 1, CAD: 1.42, EUR: 0.889, JPY: 157.8, INR: 96.37 };

test('converts an amount through USD into each target', () => {
    const result = convert({ amount: 100, from: 'CAD', to: ['EUR', 'INR'] }, usdRates);
    assert.equal(result.results[0].code, 'EUR');
    assert.ok(Math.abs(result.results[0].value - 100 * 0.889 / 1.42) < 1e-9);
    assert.ok(Math.abs(result.results[1].rate - 96.37 / 1.42) < 1e-9);
});

test('accepts lowercase codes and drops duplicates and the source currency', () => {
    const result = convert({ amount: 1, from: 'usd', to: ['eur', 'EUR', 'usd'] }, usdRates);
    assert.equal(result.from, 'USD');
    assert.deepEqual(result.results.map(r => r.code), ['EUR']);
});

test('rounds yen to whole units and other currencies to cents in the display text', () => {
    const result = convert({ amount: 10, from: 'USD', to: ['JPY', 'EUR'] }, usdRates);
    assert.equal(result.results[0].display, '1,578');
    assert.equal(result.results[1].display, '8.89');
});

test('defaults the amount to 1 when none is given', () => {
    assert.equal(convert({ from: 'USD', to: ['CAD'] }, usdRates).amount, 1);
});

test('rejects unknown currency codes with a clear message', () => {
    assert.throws(() => convert({ amount: 1, from: 'USD', to: ['XYZ'] }, usdRates), /Unknown currency: XYZ/);
    assert.throws(() => convert({ amount: 1, from: 'ABC', to: ['EUR'] }, usdRates), /Unknown currency: ABC/);
});

test('rejects negative or non-numeric amounts', () => {
    assert.throws(() => convert({ amount: -5, from: 'USD', to: ['EUR'] }, usdRates), /amount/);
    assert.throws(() => convert({ amount: 'ten', from: 'USD', to: ['EUR'] }, usdRates), /amount/);
});

test('rejects an empty target list', () => {
    assert.throws(() => convert({ amount: 1, from: 'USD', to: [] }, usdRates), /at least one/);
});

test('currencies without a single country get a globe instead of a broken flag', async () => {
    const { currencyFlag } = await import('../src/convert.js');
    assert.equal(currencyFlag('XAF'), '🌐');
    assert.equal(currencyFlag('CAD'), '🇨🇦');
});
