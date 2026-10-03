// Live USD-based rates, with a second feed in case the first is down.
const PRIMARY_FEED = 'https://open.er-api.com/v6/latest/USD';
const BACKUP_FEED = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';
const CACHE_SECONDS = 3600;

async function fetchPrimary() {
    const response = await fetch(PRIMARY_FEED, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
    if (!response.ok) throw new Error(`primary feed returned ${response.status}`);
    const data = await response.json();
    if (data.result !== 'success') throw new Error('primary feed reported failure');
    return { rates: data.rates, updated: new Date(data.time_last_update_unix * 1000).toISOString(), source: 'open.er-api.com' };
}

async function fetchBackup() {
    const response = await fetch(BACKUP_FEED, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
    if (!response.ok) throw new Error(`backup feed returned ${response.status}`);
    const data = await response.json();
    const rates = {};
    for (const [code, value] of Object.entries(data.usd)) rates[code.toUpperCase()] = value;
    return { rates, updated: new Date(data.date).toISOString(), source: 'currency-api' };
}

export async function getUsdRates(fetchers = [fetchPrimary, fetchBackup]) {
    const failures = [];
    for (const fetcher of fetchers) {
        try {
            return await fetcher();
        } catch (error) {
            failures.push(error.message);
        }
    }
    throw new Error(`Both rate feeds are unavailable (${failures.join('; ')})`);
}
