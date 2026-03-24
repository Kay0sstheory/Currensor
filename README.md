# Curren$or 💱

A sleek currency converter you can self-host in seconds. Compare up to 5 currencies at once with live exchange rates, swap them around, search through 50 options. One HTML file, zero setup.

![Built with HTML/CSS/JS](https://img.shields.io/badge/Built_with-HTML_%2F_CSS_%2F_JS-E8FF59?style=flat-square&labelColor=0D0D0F)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-blue?style=flat-square&labelColor=0D0D0F)
![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square&labelColor=0D0D0F)

**[→ Try it live](https://kay0sstheory.github.io/Currensor/)**

---

## Features

- **Live exchange rates** — Fetched from open APIs with auto-refresh every 5 minutes
- **50 currencies** — Grouped by region (Americas, Europe, Asia & Pacific, Middle East & Africa)
- **Multi-currency view** — See up to 5 conversions side by side
- **Smart swap logic** — Picking a currency already in use auto-swaps instead of duplicating
- **Bottom-sheet picker** — Mobile-friendly selector with instant search
- **Graceful fallback** — Bundled rates kick in if APIs are unavailable
- **Zero dependencies** — One HTML file. No frameworks, no build step, no node_modules

## How to Use

**Option 1: Just open it**
```bash
git clone https://github.com/Kay0sstheory/Currensor.git
cd Currensor
# Open index.html in your browser
```

**Option 2: GitHub Pages** *(free hosting)*
Already live at **[kay0sstheory.github.io/Currensor](https://kay0sstheory.github.io/Currensor/)**

## Supported Currencies

**Americas:** USD, CAD, MXN, BRL, ARS, CLP, COP, PEN
**Europe:** EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, TRY, RUB, UAH, ISK
**Asia & Pacific:** JPY, CNY, INR, KRW, SGD, HKD, TWD, THB, MYR, IDR, PHP, VND, PKR, BDT, LKR, AUD, NZD
**Middle East & Africa:** AED, SAR, QAR, KWD, BHD, ILS, EGP, ZAR, NGN, KES, MAD

## Tech Stack

- Pure HTML, CSS, JavaScript — no frameworks, no libraries
- [Open Exchange Rates API](https://open.er-api.com/) (primary) + [Currency API](https://github.com/fawazahmed0/exchange-api) (backup)
- DM Sans + Space Mono fonts via Google Fonts
- Dark theme with noise texture and accent glow effects
- Mobile-responsive down to 360px viewport

## Version History

- **v2.0** — Live exchange rates, 50 currencies grouped by region, live status indicator, improved mobile UX
- **v1.0** — Initial release with bundled rates and 20 currencies

## Roadmap

- [ ] Interactive globe for selecting target currencies (v3)
- [ ] Shareable URLs with encoded conversion state
- [ ] Light/dark theme toggle
- [ ] Drag-to-reorder target currencies
- [ ] Favorites saved to localStorage

## Why I Built This

I'm building tools with AI and learning in public. I can't write code from scratch (yet), but I can design, think through problems, and ship real products by collaborating with AI. Every project teaches me something new.

Follow along: [@Kay0sstheory](https://github.com/Kay0sstheory)

## License

MIT — do whatever you want with it.
