#!/bin/sh
# Plain usage summary from the live counter. Run: npm run usage
cd "$(dirname "$0")/.." || exit 1
# Wrangler's errors are kept and shown, so a failed lookup says why instead of crashing.
errors=$(mktemp); trap 'rm -f "$errors"' EXIT
query() { npx wrangler d1 execute currensor-usage --remote --json --command "$1" 2>"$errors" | ERRORS="$errors" node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let rows;
try{rows=JSON.parse(s)[0].results}catch(e){rows=null}
if(!rows){const why=require("fs").readFileSync(process.env.ERRORS,"utf8")||s;
console.log("  Could not reach the usage counter. Wrangler said:\n  "+why.trim().split("\n").slice(-5).join("\n  "));return}
if(!rows.length){console.log("  (nothing yet)");return}
for(const r of rows)console.log("  "+Object.values(r).join("  |  "))})'; }
echo "Last 14 days — conversions and connections per app:"
query "SELECT day, client, SUM(CASE WHEN event='convert' THEN count END) AS conversions, SUM(CASE WHEN event='connect' THEN count END) AS connections FROM daily_usage WHERE day >= date('now','-14 days') GROUP BY day, client ORDER BY day DESC, client"
echo "Top currency pairs, all time:"
query "SELECT currency_pair, SUM(count) AS times FROM daily_usage WHERE event='convert' GROUP BY currency_pair ORDER BY times DESC LIMIT 10"
echo "People vs robots per day (robots labelled from 2026-10-09; before that they sit under 'other'):"
query "SELECT day, SUM(CASE WHEN client<>'robot' AND event='convert' THEN count ELSE 0 END) AS people_conversions, SUM(CASE WHEN client<>'robot' AND event='connect' THEN count ELSE 0 END) AS people_connections, SUM(CASE WHEN client='robot' THEN count ELSE 0 END) AS robot_visits FROM daily_usage WHERE day >= date('now','-14 days') GROUP BY day ORDER BY day DESC"
