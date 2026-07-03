# Catalog Quality Auditor

## What It Does

Catalog Quality Auditor is a tool that scans an e-commerce product catalog export (CSV, TSV, or Excel) and automatically flags what's wrong with it — missing information, duplicate listings, and weak SEO — then hands back a prioritized fix list instead of a messy spreadsheet.

Upload a file, get a dashboard.

## Why I Built It

I'm moving into e-commerce operations roles — Catalog Manager, Marketplace Operations, Business Analyst — and wanted to build something that solves a problem those teams actually deal with: bloated, inconsistent product catalogs that quietly hurt sales (missing bullet points, near-duplicate listings from bulk uploads, weak titles that don't rank).

Rather than just describe that I understand catalog quality problems, this tool actually finds them — and prioritizes them the way a real marketplace (like Amazon Seller Central) would.

## Key Features

- **Missing field detection** — flags listings missing required data: title, bullet points, images, category
- **Duplicate detection** — a two-tier system that catches both exact duplicates (80%+ similarity) and possible duplicates worth a second look (50–79% similarity), with a similarity score and source SKU reference for each
- **SEO quality scoring (0–100)** — every listing gets a rule-based score so results are instant, free, and consistent
- **Prioritized fix list** — sorted by risk level first, then issue count, mirroring how real marketplace listing-quality tools prioritize
- **Sortable, searchable dashboard** — filter by risk level, search by SKU/title, sort any column
- **Report history** — the last 10 audit runs are saved automatically, so you can track catalog health over time
- **Excel export** — a 4-tab workbook (Summary, Fix List, High Risk, Duplicates) ready to share
- **Column-agnostic file parsing** — works with real marketplace flat files, including ones that split bullet points or images across multiple columns

## Screenshots

*(to be added)*

## Tech Stack

- **Next.js 14** (App Router) — web framework
- **TypeScript** — programming language
- **Tailwind CSS** — styling
- **papaparse** — CSV/TSV parsing
- **SheetJS (xlsx)** — Excel file parsing and export
- **React Context** — app state management (no external state library)
- **Browser storage (localStorage)** — report history, no database for MVP

## How Decisions Were Made

A few choices are worth explaining, because they were deliberate trade-offs, not defaults:

- **Rule-based SEO scoring instead of AI.** Scoring needed to be instant, free, and give the exact same listing the exact same score every time — that consistency matters when it's driving prioritization. AI is reserved for a future *rewrite suggestions* feature, where language quality actually benefits from a model's judgment.
- **Two-tier duplicate detection instead of one threshold.** A single similarity cutoff forces a bad choice: too strict and you miss real duplicates, too loose and you flood the list with false positives. Splitting it into "hard duplicate" (80%+) and "possible duplicate" (50–79%, flagged but not asserted) avoids crying wolf while still surfacing borderline cases for a human to judge.
- **No database for the MVP.** localStorage plus React Context was enough to prove the concept end-to-end without the overhead of setting up and hosting a database — that's a "come back to later" decision, not a permanent one.
- **Fix list sorted by risk level, then issue count.** This mirrors how Amazon Seller Central actually prioritizes listing-quality issues, so the tool's output maps to a workflow a real catalog manager already recognizes.

## Roadmap

- [ ] PDF export (next up)
- [ ] AI-generated rewrite suggestions for low-scoring listings (optional, requires an Anthropic API key)
- [ ] Final review / polish pass

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` and either upload a catalog file or use the built-in sample data generator to try it instantly.
