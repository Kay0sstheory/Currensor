// Anonymous daily counts so Kay can see whether people use Currensor and from which app.
// Stores only the day, the app, the event and the currency pair: no amounts, no IPs, no chat text.
const INCREMENT_SQL = `INSERT INTO daily_usage (day, client, event, currency_pair, count) VALUES (?, ?, ?, ?, 1)
ON CONFLICT (day, client, event, currency_pair) DO UPDATE SET count = count + 1`;

const ROBOT_SIGNS = /bot\b|bot\/|crawler|spider|scanner|python|aiohttp|httpx|curl\/|wget|go-http|axios|headless/;

export function clientFromUserAgent(userAgent) {
    const agent = String(userAgent || '').toLowerCase();
    // Checked first: crawlers like ClaudeBot and GPTBot carry an app's name but no person is behind them.
    if (ROBOT_SIGNS.test(agent)) return 'robot';
    if (agent.includes('claude') || agent.includes('anthropic')) return 'claude';
    if (agent.includes('openai') || agent.includes('chatgpt')) return 'chatgpt';
    return 'other';
}

function currencyPairs(from, to) {
    if (!from || !Array.isArray(to) || to.length === 0) return [''];
    return to.map(target => `${String(from).toUpperCase()}>${String(target).toUpperCase()}`);
}

export async function recordUsage(database, { client, event, from, to, when = new Date() }) {
    if (!database) return;
    const day = when.toISOString().slice(0, 10);
    try {
        for (const pair of currencyPairs(from, to)) {
            await database.prepare(INCREMENT_SQL).bind(day, client, event, pair).run();
        }
    } catch (error) {
        // Counting is a nice-to-have; a conversion must never fail because of it.
        console.error('usage counter failed:', error.message);
    }
}
