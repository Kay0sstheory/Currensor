#!/bin/sh
# Plain usage summary from the live counter. Run: npm run usage
cd "$(dirname "$0")/.." || exit 1
query() { npx wrangler d1 execute currensor-usage --remote --json --command "$1" 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const rows=JSON.parse(s)[0].results;
if(!rows.length){console.log("  (nothing yet)");return}
for(const r of rows)console.log("  "+Object.values(r).join("  |  "))})'; }
echo "Last 14 days — conversions and connections per app:"
query "SELECT day, client, SUM(CASE WHEN event='convert' THEN count END) AS conversions, SUM(CASE WHEN event='connect' THEN count END) AS connections FROM daily_usage WHERE day >= date('now','-14 days') GROUP BY day, client ORDER BY day DESC, client"
echo "Top currency pairs, all time:"
query "SELECT currency_pair, SUM(count) AS times FROM daily_usage WHERE event='convert' GROUP BY currency_pair ORDER BY times DESC LIMIT 10"
