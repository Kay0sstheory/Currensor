// Small public rates service: refreshes hourly on a timer, serves the stored copy to the website.
// Separate from the plugin server so that server stays exactly as the store reviewers saw it.
import { fetchOpenExchangeRates, refreshStoredRates, readRates } from './hourly-rates.js';
import { getUsdRates } from './rates.js';

const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
};

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
        if (pathname !== '/rates') return new Response('Not found', { status: 404 });
        try {
            const rates = await readRates({ store: env.RATES, fallback: () => getUsdRates() });
            return new Response(JSON.stringify(rates), { headers: HEADERS });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 503, headers: HEADERS });
        }
    },

    async scheduled(_event, env) {
        await refreshStoredRates({ fetchHourly: () => fetchOpenExchangeRates(env.OXR_APP_ID), store: env.RATES });
    },
};
