# Content Revenue OS — Winner Library V1

## What the app does

The Winner Library is a local app for collecting and comparing content that **shows evidence of working** — posts, reels, creator accounts, ads, hooks, funnels and offers — so you can learn from them and decide what to test yourself.

- **Dashboard** with KPI cards: total items, approved tests, winners, average opportunity score
- **Table view** with search (searches all text fields), filters (platform, content type, status, niche) and sorting (by opportunity score, newest, title)
- **Add / edit** form with all 65 fields, grouped into sections (Basics, Hook & Opening, Psychology, Funnel & Offer, Performance, Analysis, Scores, Result Tracking, Our Test)
- **Detail view** for each item, with **delete** (asks for confirmation)
- **German interface.** Labels are display-only (`label` / `optionLabels` in `config\winner-fields.json`); stored field keys and values stay English, so data, exports and imports are unaffected.
- **Automatic Overall Opportunity Score** (see below)
- **Export** to CSV (for Excel) and JSON; **safe JSON import**

## Offer and result tracking (schema version 2)

**One test per winner.** Added on 2026-10-09; no existing field was changed or removed, old items simply have these fields empty.

- **Funnel & Angebot (new):** `offerType` (Angebotstyp), `offerPromise` (Kernversprechen), `offerPrice` (Preis), `offerUrl` (Landingpage / Checkout), `offerStatus` (Angebotsstatus). `offerProduct` stays as before.
- **Ergebnis-Tracking (new group, our own video):** `ownVideoUrl`, `ownPlatform`, `ownPublishDate`, `ownTrackingDate`, `ownViews`, `ownAvgWatchPercent`, `ownComments`, `ownShares`, `ownSaves`, `ownKeywordComments`, `ownLeads`, `ownSales`, `ownCosts`. Revenue stays in the existing `revenueGenerated` (group "Unser Test").
- The `own…` fields are separate from the **Performance** group, which describes the *original* (foreign) content.
- **Rule:** set status to `Winner` only when the test shows measured leads or revenue, not reach alone. Enter measured values only; leave unknown ones empty.
- No calculated metrics (conversion, ROI) yet. Planned for later, once real numbers exist.
- Backup of the files before this change: `data\backups\pre-schema2-2026-10-09\`.

## Chosen technology

- **Zero install.** Runs on Windows' built-in PowerShell 5.1. No Python, Node.js, database or internet connection needed.
- `server.ps1` — a small local web server (only reachable from this computer, at `http://localhost:8787`)
- `public/` — the browser interface (plain HTML, CSS, JavaScript)
- `data/winners.json` — your data, as one readable JSON file

## How to start it on Windows

1. Open the folder `C:\Users\Andy\Content-Revenue-OS`
2. Double-click **`Start-WinnerLibrary.bat`**
3. Your browser opens **http://localhost:8787/** automatically. If not, type that address into your browser.
4. **Keep the black window open** while you use the app. To stop the app, close that window (or press Ctrl+C in it).

If you see "Could not start on port 8787", the app is probably already running in another window — just open http://localhost:8787/ in your browser.

## Opportunity score formula

```
Overall Opportunity Score (0–100) =
  average of the filled-in scores (each 1–10) × 10, rounded to a whole number
```

The 8 criteria all count equally: Pain intensity, Urgency, Purchase intent, Content potential, Differentiation, Ease of production, Monetization potential, Evidence strength.

- Example: scores 9, 8, 7, 9, 6, 8, 7, 5 → average 7.375 → score **74**
- Empty criteria are ignored. The app shows how many of the 8 were scored (e.g. "5/8 bewertet") so you can tell partial scores apart from complete ones.
- If no criterion is scored, there is no overall score ("–"). Unscored items appear at the bottom when sorting by score.

## Where the local data is stored

| What | Where |
|---|---|
| All items | `data\winners.json` |
| Automatic daily backup (state before the first change of each day) | `data\backups\winners-YYYY-MM-DD.json` |
| Automatic backup before every import | `data\backups\winners-before-import-….json` |
| Field definitions | `config\winner-fields.json` |
| Example entry used on first start | `config\seed.json` |

## How to back it up

- **Easiest:** in the app, open **Daten ▾ → Alles als JSON exportieren** and keep the file somewhere safe (e.g. OneDrive or a USB stick).
- **Or:** copy the whole `data` folder.
- **To restore:** stop the app, replace `data\winners.json` with a backup file (rename it to `winners.json`), start the app again. Alternatively use **Import JSON** with an exported file.

## How imports and exports work

**Export** (menu **Daten ▾**):
- **CSV** — for Excel. Uses your Windows list separator (`;` on German systems) and UTF-8, so umlauts and columns display correctly. Text starting with `=`, `+`, `-` or `@` gets a leading `'` so Excel never runs it as a formula.
- **JSON** — the complete data plus the score formula. This is the format to use for backups and for re-importing.

**Import JSON** (menu **Daten ▾ → JSON importieren…**):
- Accepts a JSON file exported by this app, or a plain list of items (`[ {...}, {...} ]`).
- **Every item is checked first.** If any item is invalid (e.g. missing title, unknown platform, score outside 1–10, URL not starting with http/https), **nothing is imported** and you see a list of the problems.
- Items whose `id` already exists are **updated**; all others are **added**. Nothing is deleted by an import.
- Unknown fields are ignored. The overall score is always recalculated.
- A backup of your current data is saved automatically before the import.

**For future agents / tools:** the app has a small local API (create, update, import) that validates every record the same way. It's documented in `CLAUDE.md`, and the field names are in `config\winner-fields.json`.

## KI-Erfassungsassistent (Entwicklungszweig)

Nach dem lokalen Start unter **http://localhost:8787/assistant.html** erreichbar.
Quelltext einfügen, Analyseauftrag in einem vorhandenen oder kostenlosen KI-Zugang verwenden,
JSON prüfen und nach dem Quellenabgleich den Export ausdrücklich freigeben.
Unbekannte Werte bleiben leer; eine Strukturprüfung kann die Faktenprüfung nicht ersetzen.
Der Export schreibt nichts in die Library. Erst **Daten → JSON importieren → Importieren** speichert.
Details: [docs/ki-erfassungsassistent-v1.md](docs/ki-erfassungsassistent-v1.md).

## Tests

Die Tests gegen eine **temporäre Kopie ohne vorhandene Geschäftsdaten** ausführen:

```powershell
powershell -ExecutionPolicy Bypass -File tests\run-isolated.ps1
powershell -ExecutionPolicy Bypass -File tests\run-isolated.ps1 -IncludeUi
```

Der zweite Aufruf benötigt Microsoft Edge. Der Starter kopiert nur Code, Schema und
Beispielkonfiguration, startet einen eigenen Server auf einem freien Port und entfernt
anschließend die Testkopie. Die Anwendung selbst benötigt weiterhin keine Installation.
Die einzelnen Skripte `api-smoke-test.ps1` und `ui-test.ps1` schreiben Testeinträge;
sie daher nicht direkt gegen den produktiven Server starten.

Zusätzliche Entwicklertests (Node erforderlich, keine Produktabhängigkeit):

```sh
node tests/assistant-validation.test.js
node tests/assistant-browser.test.js
```

Der Browsertest benötigt zusätzlich Playwright, Chromium und PowerShell und startet
seine eigene temporäre Kopie. Auf Linux kann `WINNER_TEST_POWERSHELL` den Pfad zu
`pwsh` und `WINNER_TEST_CHROMIUM` den Chromium-Pfad festlegen. Das ist kein Ersatz
für die Abnahme auf Windows PowerShell 5.1 und Edge.
