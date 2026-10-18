# Content Revenue OS — project memory

## Purpose

Content Revenue OS is a system for finding, analysing, adapting and testing content that demonstrably works, and turning it into **leads and sales through owned products** — not platform payouts.

The first module is the **Winner Library** (V1, built 2026-10-07): a local database of content, creator accounts, ads, hooks, funnels and offers that show evidence of working, scored by opportunity. Full original spec: `spec.md`.

## Roles

| Who / tool | Responsibility |
|---|---|
| **ChatGPT** | Orchestration, strategy, final decisions and QA |
| **Astra** | Market, creator, competitor and audience research |
| **Claude Code** | Software, automation, integrations and technical implementation |
| **Hailuo** | Video generation |
| **Canva Business** | Branding and final creative assets |
| **Human (owner)** | Approval is **mandatory** before any content is published |

## Principles

- Evidence is more important than hype. Never invent performance, follower or revenue numbers — leave fields empty when unknown.
- Sales and leads matter more than vanity metrics (views, likes).
- Never add another paid tool unless it creates a material advantage.
- Build simple before automating. Do not add automation until the owner asks for it.
- Work only inside this project folder. No paid external services, no external APIs unless explicitly approved.

## Technical notes (Winner Library V1)

- **Stack:** Windows PowerShell 5.1 + `System.Net.HttpListener` (`server.ps1`) serving a plain HTML/CSS/JS UI (`public/`). Zero installs — Python/Node are *not* installed on this PC.
- **Start:** double-click `Start-WinnerLibrary.bat` → http://localhost:8787/
- **Data:** `data/winners.json` (single JSON array). Daily backup of the previous state in `data/backups/` on the first change of each day; a backup is also made before every import.
- **Schema = single source of truth:** `config/winner-fields.json` defines all 65 fields (key, label, type, group, options, defaults; schemaVersion 2). The server validates against it, the UI builds its forms from it. To add a field: add it there — no other change needed for storage, form, detail view, CSV/JSON export.
- **Offer + result tracking (schemaVersion 2, 2026-10-09):** one test per winner. New `offer*` fields (type, promise, price, url, status) in group "Funnel & Angebot" and new group "Ergebnis-Tracking" with `own*` fields for *our own* video (views, watch %, comments, shares, saves, keyword comments, leads, sales, costs). Revenue stays in `revenueGenerated`. Never mix `own*` with the foreign-content `views`/`likes`/… in "Performance". Set status `Winner` only with measured leads or revenue. No calculated metrics yet (conversion/ROI would need `server.ps1` + `app.js` changes). Pre-change backup: `data/backups/pre-schema2-2026-10-09/`.
- **UI language is German** (changed 2026-10-07 per `changes.md`). `label`, `help`, group names and `optionLabels` in the schema are display-only. Stored `key`s and stored option values (e.g. status `"Approved for test"`) stay English. Never translate those, since that would break existing data, imports and the API. `index.html` has `lang="de" translate="no"` so the browser does not machine-translate the page.
- **Overall Opportunity Score (0–100)** = average of the filled-in 1–10 scores (8 criteria, equal weights) × 10, rounded. `scoredCount` = how many of the 8 were filled. Calculated server-side (`Get-OverallScore` in `server.ps1`); the UI preview mirrors it (`computeOverall` in `public/app.js`).
- **Seed data:** `config/seed.json`, only used when `data/winners.json` does not exist.
- `server.ps1` must stay **ASCII-only** (PowerShell 5.1 reads BOM-less scripts as ANSI).
- PowerShell 5.1 gotcha: never write `@(... | ConvertFrom-Json)` — it nests the array. Assign first, then `@($var)`.

## API (for future agents writing structured findings)

All on `http://localhost:8787`. Writes require `Content-Type: application/json`; foreign `Origin` headers are rejected.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/schema` | Field definitions (use the `key` values) |
| GET | `/api/items` | All items |
| GET | `/api/items/{id}` | One item |
| POST | `/api/items` | Create one item (JSON object). `title` required. Returns 400 + `details[]` on validation errors |
| PUT | `/api/items/{id}` | Partial update — only sent fields change; send `""` to clear |
| DELETE | `/api/items/{id}` | Delete |
| POST | `/api/import` | Requires `X-Winner-Import-Approved: true` after explicit user approval. Bulk add/update: `[...]` or `{ "items": [...] }`. All-or-nothing validation; matching `id` = update |
| GET | `/api/export.json` / `/api/export.csv` | Full exports |

Agents should set `researchSource` (e.g. `"Astra"`, `"Claude Research"`), `status: "Discovered"`, and fill `performanceSignals` only with observed facts.

## Tests

With the server running:
- `powershell -ExecutionPolicy Bypass -File tests\api-smoke-test.ps1` — API, validation, security guards, import/export (29 checks)
- `powershell -ExecutionPolicy Bypass -File tests\ui-test.ps1` — drives headless Edge through the real UI (28 checks)

Both create a temporary test record and delete it again. Never run these against business data. Prefer `powershell -ExecutionPolicy Bypass -File tests\run-isolated.ps1` (add `-IncludeUi` for Edge): this starts a disposable server with copied code/config only and removes it after the checks. Additional offline validation and isolated browser checks are documented in README.md.
