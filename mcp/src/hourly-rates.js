// Hourly USD rates from Open Exchange Rates, fetched on a timer and kept in storage.
// The free plan allows 1,000 requests a month, so only the scheduled job ever calls it;
// visitors read the stored copy, never the feed.
const STORE_KEY = 'latest';
// Three missed hours in a row means the hourly feed is in trouble; the daily feeds take over.
export const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function parseOpenExchangeRates(data) {
    if (data?.base !== 'USD') throw new Error(`hourly feed is not priced in USD (base ${data?.base})`);
    const rates = data.rates || {};
    if (Object.keys(rates).length === 0) throw new Error('hourly feed returned no rates');
    for (const [code, value] of Object.entries(rates)) {
        if (!(typeof value === 'number' && value > 0)) throw new Error(`hourly feed has an unusable rate for ${code}`);
    }
    return { rates, updated: new Date(data.timestamp * 1000).toISOString(), source: 'openexchangerates.org' };
}

export async function fetchOpenExchangeRates(appId) {
    if (!appId) throw new Error('OXR_APP_ID is not set');
    const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${appId}`);
    if (!response.ok) throw new Error(`hourly feed returned ${response.status}`);
    return response.json();
}

export async function refreshStoredRates({ fetchHourly, store }) {
    const parsed = parseOpenExchangeRates(await fetchHourly());
    await store.put(STORE_KEY, JSON.stringify(parsed));
    return parsed;
}

export async function readRates({ store, now = Date.now(), fallback }) {
    const saved = await store.get(STORE_KEY);
    if (saved) {
        const stored = JSON.parse(saved);
        if (now - Date.parse(stored.updated) <= MAX_AGE_MS) return stored;
    }
    return fallback();
}
