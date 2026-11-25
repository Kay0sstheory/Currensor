# Currensor — launch brief

Context for anyone (human or AI) helping write launch posts. Last updated 2026-10-04.

## What it is
- A free, open-source currency converter with live rates, no sign-up, no tracking.
- Web app: https://kay0sstheory.github.io/Currensor/ (single `index.html`, 50 currencies, works on phone).
- Also runs **inside Claude and ChatGPT** as an MCP app: ask a money question and a live
  converter card appears in the chat (166 currencies). Changing the amount on the card updates as you type.
- One small server (Cloudflare Workers, free tier) serves both Claude and ChatGPT.
- Public MCP endpoint: `https://currensor-mcp.currensor-mcp.workers.dev/mcp`
- Listed in the official MCP Registry as `io.github.Kay0sstheory/currensor`.
- Anonymous usage counter only (no personal data). Privacy: `privacy.html`, terms: `terms.html`.

## Where it stands (2026-10-04)
- Claude directory listing: submitted 2026-10-03, **in review**.
- ChatGPT app listing: submitted 2026-10-03, **in review**.
- Until approved, people can use it in Claude via Settings → Connectors → Add custom connector
  → paste the endpoint above.
- Do not claim "available in the Claude/ChatGPT store" until both approve.

## What testing showed
- In Claude, plain questions ("what's ¥5000 in pounds?") led Claude to offer Currensor in 2 of 3 tries.
  Real result from that test: ¥5000 → £23.96.
- In ChatGPT, its built-in converter answers plain questions; Currensor runs when picked or named
  ("@Currensor"). So posts should lead with Claude.

## Assets
- Showcase video: 47s, landscape 1920×1080 and portrait 1080×1920
  (`currensor-showcase.mp4`, `currensor-showcase-portrait.mp4` — kept off git, in Kay's Drive Transfer folder).
- Unlisted YouTube cut: https://youtu.be/8yRNPmepvnA
- Card screenshot in repo: `docs/claude-card.png`.

## Launch plan
- Now: free AI-tool directories (Smithery, Glama, mcp.so, PulseMCP); LinkedIn "here's what I built" post. X posted 2026-10-05 (see Launch log).
- After both stores approve: X + LinkedIn with store links, Reddit (Claude / ChatGPT / MCP communities),
  Hacker News "Show HN", Product Hunt.
- Angles that work: the card living inside the chat is the surprise; "free, no sign-up" earns trust.

## X post — draft v1 (attach portrait video)

Main post (~210 chars, links kept out because X shows link posts to fewer people):

> I built a currency converter that lives inside your AI chat.
>
> Ask Claude or ChatGPT "what's ¥5000 in pounds?" and a live card pops up. Change the amount and it updates as you type.
>
> Free. No sign-up. Open source.
>
> Links below 👇

First reply:

> Web version: kay0sstheory.github.io/Currensor
>
> Use it in Claude today: Settings → Connectors → Add custom connector → paste
> currensor-mcp.currensor-mcp.workers.dev/mcp
>
> Claude and ChatGPT store listings are in review.
>
> Code: github.com/Kay0sstheory/Currensor

## ChatGPT store launch — draft v2 (2026-11-24, POSTED by Kay)

Attach: video/out/currensor-showcase-portrait.mp4 (same video as the October post).

X post:

Currensor is now live in the ChatGPT store 💱

Call Currensor by name in ChatGPT and ask "250 CAD in rupees, euros and yen?" A live card shows every result side by side. Change the amount and it updates as you type.

Free. No sign-up. Open source.

Link below 👇

X first reply:

Add it in ChatGPT: chatgpt.com/plugins/plugin_asdk_app_6ac137cf0fc081918bcde5f77497877c

On Claude? The store listing is still in review, but you can add it today: Settings → Connectors → Add custom connector → paste currensor-mcp.currensor-mcp.workers.dev/mcp

Code: github.com/Kay0sstheory/Currensor

LinkedIn post:

A small milestone: Currensor, the currency converter I built with AI, is now approved and live in the ChatGPT store.

Call Currensor by name in ChatGPT and ask something like "250 CAD in rupees, euros and yen?" A live card appears right inside the chat with every result side by side. Change the amount and every currency updates instantly.

What getting it through review taught me:
- My first submission was rejected. I appealed, fixed the setup and resubmitted, and it passed the second time.
- Getting through review took longer than building it. Claude's directory review is still going, seven weeks in.
- Independent directories found it on their own, and one rates it 92 out of 100 for reliability.

It's free, needs no sign-up, stores nothing about you, and the code is open source.

Links in the first comment.

#BuildingWithAI #OpenSource #ChatGPT #MCP

LinkedIn first comment: the same three links as the X reply.

## Launch log
- 2026-10-05 — X post live with the portrait video (final wording: "Just shipped Currensor 💱", feature list, both links, #OpenSource #CurrencyConverter #MCP): https://x.com/kartiknv/status/2107012081694453792
- 2026-10-05 — LinkedIn post live (portrait video, Claude-first, links in first comment): https://www.linkedin.com/feed/update/urn:li:activity:7513005465715425282/ (the old lnkd.in/p/g8mjZRNn link pointed at a deleted earlier copy of the post)
- 2026-10-06 check — X: 121 views, 6 likes, 3 replies, 0 reposts. LinkedIn: 130 impressions, 2 reactions, 2 comments.
- 2026-10-05 — Directories: Glama already lists it automatically (from the MCP Registry); PulseMCP submissions paused, auto-adds from the registry when it reopens; Smithery + mcp.so = Kay to submit.
- 2026-10-05 — Smithery listing live: https://smithery.ai/servers/venkatknukala/currensor (68/100 at publish; description/homepage/icon still to fill in Settings)
- 2026-10-05 — mcp.so: web form is paid-only ($39, skipped); free request filed on GitHub: https://github.com/chatmcp/mcpso/issues/4784 (their free queue is slow: ~200 open, 1 handled in 4 days)
- 2026-10-05 — Smithery listing completed (name, description, homepage, icon): score 100/100
- 2026-11-24 — ChatGPT store launch: X thread with video https://x.com/kartiknv/status/2125409660568318417 ; LinkedIn post with video (6 impressions at first check; links comment added by Claude same day).
