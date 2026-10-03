// Same rule as the web app: these currencies have no minor unit in everyday use.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'HUF', 'ISK', 'UGX', 'PYG']);
const MAX_TARGETS = 12;

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export function currencyName(code) {
    try {
        return currencyNames.of(code);
    } catch {
        return code;
    }
}

// Two regional-indicator letters from the code's country part; EUR maps to the EU flag.
// X-codes (gold, IMF units, CFA francs) have no single country, so they get a globe.
export function currencyFlag(code) {
    if (code.startsWith('X')) return '🌐';
    const country = code.slice(0, 2);
    return String.fromCodePoint(...[...country].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export function formatAmount(value, code) {
    const digits = ZERO_DECIMAL.has(code) ? 0 : 2;
    return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function requireKnown(code, usdRates) {
    const normalized = String(code).trim().toUpperCase();
    if (!(normalized in usdRates)) throw new Error(`Unknown currency: ${normalized}`);
    return normalized;
}

function parseAmount(amount) {
    if (amount === undefined || amount === null || amount === '') return 1;
    const number = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(number) || number < 0) {
        throw new Error('The amount must be a number of zero or more');
    }
    return number;
}

export function convert({ amount, from, to }, usdRates) {
    const parsedAmount = parseAmount(amount);
    const fromCode = requireKnown(from, usdRates);
    const targetCodes = [...new Set((to || []).map(code => requireKnown(code, usdRates)))]
        .filter(code => code !== fromCode)
        .slice(0, MAX_TARGETS);
    if (targetCodes.length === 0) throw new Error('Give at least one currency to convert into');

    const results = targetCodes.map(code => {
        const rate = usdRates[code] / usdRates[fromCode];
        const value = parsedAmount * rate;
        return { code, name: currencyName(code), flag: currencyFlag(code), rate, value, display: formatAmount(value, code) };
    });

    return {
        amount: parsedAmount,
        from: fromCode,
        fromName: currencyName(fromCode),
        fromFlag: currencyFlag(fromCode),
        zeroDecimal: [...ZERO_DECIMAL],
        results,
    };
}
