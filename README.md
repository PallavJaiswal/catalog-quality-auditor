# Catalog Quality Auditor

**Live demo:** https://catalog-quality-auditor.vercel.app
**Repo:** https://github.com/PallavJaiswal/catalog-quality-auditor

## What It Does

Catalog Quality Auditor scans an e-commerce product catalog export (CSV, TSV, or Excel) and automatically flags what's wrong with it — missing information, duplicate listings, and weak SEO — then hands back a prioritized fix list, AI-generated rewrite suggestions, and a shareable report.

Upload a file, get a dashboard.

## Why I Built It

I'm moving into e-commerce operations roles — Catalog Manager, Marketplace Operations, Business Analyst — and wanted to build something that solves a problem those teams actually deal with: bloated, inconsistent product catalogs that quietly hurt sales (missing bullet points, near-duplicate listings from bulk uploads, weak titles that don't rank).

Rather than just describe that I understand catalog quality problems, this tool actually finds them — tested against a real, messy Amazon export, not just clean sample data — and prioritizes them the way a real marketplace (like Amazon Seller Central) would.

## Key Features

- **Smart column auto-mapping** — reads real-world marketplace files where columns are never named what you'd expect (`name` instead of `title`, `brandName` instead of `brand`), using a word-aware matching system rather than naive text search
- **Manual mapping confirmation** — every upload shows an editable, pre-filled mapping screen before the audit runs, the same pattern professional import tools (Shopify, Mailchimp) use
- **Missing field detection** — flags listings missing required data: title, bullet points, images, category
- **Duplicate detection** — a two-tier system that catches both exact duplicates (80%+ similarity) and possible duplicates worth a second look (50–79%), with a similarity score and source SKU reference; aware of Amazon-style parent/child variation families so legitimate size/color variants aren't flagged as duplicates
- **SEO quality scoring (0–100)** — rule-based, so scores are instant, free, and 100% consistent
- **AI rewrite suggestions** — generates an improved title and bullet points for low-scoring listings, shown side-by-side with the original (never auto-applied)
- **Bulk AI rewrite** — queues every flagged listing at once instead of one at a time, respecting the same per-visitor AI budget
- **Generate listing from a product URL** — paste a manufacturer/source page link and get an AI-drafted title, bullets, and description grounded in that page's real content; fetching is SSRF-guarded (blocks localhost/private-IP targets, including DNS-rebinding attempts) and every output is checked for verbatim overlap with the source so rewrites can't accidentally lift original wording
- **Compliance risk scanner** — flags marketplace-policy-risk language (unsubstantiated health claims, guarantee language, embedded contact info/URLs, restricted-category wording) before a listing goes live
- **AI duplicate verdict** — for borderline duplicate pairs, asks the model to call it: same listing duplicated, a legitimate size/color variant, or genuinely different products
- **AI executive summary** — a stakeholder-ready, plain-English writeup of an audit run, referencing real SKUs and numbers
- **Per-visitor AI usage limit** — each AI feature is capped at 2 free uses per visitor, enforced server-side via a signed cookie (not just a client-side check), so a public demo visitor can't run up unlimited API calls
- **Prioritized fix list** — sorted by risk level, then issue count, mirroring real marketplace listing-quality workflows
- **Sortable, searchable dashboard** with risk filters
- **Report history** — last 10 audit runs saved automatically
- **Excel export** (4-tab workbook) and **PDF export** (print-friendly report)

## Screenshots

*(to be added)*

## Tech Stack

- **Next.js 16** (App Router, Turbopack) — web framework
- **TypeScript** — programming language
- **Tailwind CSS** — styling
- **Geist + Geist Mono** — self-hosted type pair via `next/font`
- **papaparse** — CSV/TSV parsing
- **SheetJS (xlsx)** — Excel parsing and export
- **jsPDF + jspdf-autotable** — PDF export
- **React Context** — app state management (no external state library)
- **Browser storage (localStorage)** — report history, no database for the MVP
- **AI features** (rewrite, bulk rewrite, generate-from-link, compliance scan, duplicate verdict, executive summary) — one shared provider switch, not hardcoded: Claude Haiku for local development/testing, Groq (Llama 3.3 70B) on the public deployment, chosen so a public demo can't run up a real API bill
- **Deployed on Vercel**, connected to this GitHub repo for automatic deploys

## How Decisions Were Made

A few choices are worth explaining, because they were deliberate trade-offs, not defaults:

- **Rule-based SEO scoring instead of AI.** Scoring needed to be instant, free, and 100% consistent — that matters when it's driving prioritization. AI is reserved for the rewrite step, where language quality actually benefits from a model's judgment.
- **Word-aware column matching, not simple text search.** Testing against a real Amazon export revealed the original matcher had a real bug — it matched "title" to a `brandName` column simply because the word "name" appeared inside it. Rebuilt to score exact word matches far higher than a word merely appearing inside another.
- **A confirmation step on every upload, not just when detection fails.** Auto-detection is a convenience, not a guarantee — showing a human-editable mapping every time (pre-filled with the best guess) catches errors before they silently corrupt a report.
- **AI provider is configurable, not hardcoded to one vendor.** Locally, it uses Claude for testing and comparison. The public deployment uses Groq instead — a free-tier provider — specifically so a stranger clicking around the live demo can't run up a real bill. Same code, different environment settings.
- **Two-tier duplicate detection instead of one threshold.** A single similarity cutoff forces a bad trade-off: too strict misses real duplicates, too loose floods the list with false positives. Splitting it into "hard duplicate" (80%+) and "possible duplicate" (50–79%, flagged but not asserted) avoids crying wolf while still surfacing borderline cases for a human to judge.
- **A signed, server-side usage cookie instead of a login wall.** The public demo needed real abuse protection without forcing a sign-up flow just to try the tool. Each AI feature (rewrite, bulk rewrite, compliance scan, duplicate verdict, executive summary, generate-from-link) is capped at 2 free uses per visitor, tracked in an httpOnly cookie that the API routes themselves check and update — not a client-side localStorage flag, which a visitor could bypass just by calling the API directly or clearing browser storage. The cookie is HMAC-signed so the count can't be edited by hand in devtools either.
- **SSRF-guarded scraping for the "generate from link" feature.** Fetching an arbitrary user-submitted URL server-side is a classic SSRF vector. The fetch validates protocol, blocks local/internal hostnames, resolves DNS and rejects private-IP results (including on each redirect hop, since a public hostname can still redirect to an internal address), and caps response size and redirect count.
- **No database for the MVP.** localStorage plus React Context proved the concept end-to-end without the overhead of hosting a database — a "come back to later" decision, not a permanent one.

## Roadmap

- [ ] Custom domain + a central portfolio page linking this and future projects
- [ ] Optional further polish pass

## Getting Started

```bash
npm install
npm run dev
```

You'll need a `.env.local` file with:
```
ANTHROPIC_API_KEY=your_key      # for local testing
GROQ_API_KEY=your_key           # for the public-deployment code path
AI_PROVIDER=claude              # omit or set to "groq" to test that path instead
USAGE_COOKIE_SECRET=any_random_string   # optional locally; set a real random value in production (e.g. Vercel env vars) to sign the per-visitor AI usage cookie
```

Then open `http://localhost:3000` and either upload a catalog file or use the built-in sample data generator to try it instantly.
