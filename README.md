# Business Loomline (Balooo)

Business decision layer for **The Hullabalooo × The Pappy Show**.
A Google Sheet is the database, Google Apps Script is the API, and a single
HTML dashboard (hosted on your own domain) is the front end.

```
You / your team          Google Sheet              Apps Script            Your domain
enter weekly data  --->  7 tabs, 1 table    --->   doGet() reads    --->  dashboard fetches
(or import CSVs)         per function              tabs, returns JSON     JSON + renders
```

This is the same architecture as Loomline (fashion intelligence), so the two
apps stay consistent — and the **Industry** tab here can be fed straight from
Loomline's Trend Radar sheet.

---

## The spreadsheet: 7 tabs

One spreadsheet, one tab per function. Every tab is a clean table: row 1 is
headers, each row below is one record. No merged cells, no totals rows (the
dashboard computes totals), no blank header columns.

### 1. `Sales` — the core table (powers Overview + Brand Performance)

One row per **week × brand × channel × category × collection × geo** combination.
This one table answers every filter in the dashboard.

| Week | Brand | Channel | Category | Collection | Geo | Units | Revenue | Discount | Returns |
|------|-------|---------|----------|------------|-----|-------|---------|----------|---------|
| 2026-07-13 | The Hullabalooo | Website | Dresses | SS26 | Mumbai | 42 | 189000 | 12000 | 2 |

- **Week**: Monday of the week (date format). Weekly, not daily — daily is
  more typing for no dashboard benefit.
- **Brand**: exactly `The Hullabalooo` or `The Pappy Show` (use Data Validation
  dropdowns so spellings never drift).
- **Channel**: Website / Marketplace / Retail / Popup / Wholesale — your call,
  but fix the list with a dropdown.
- Only add rows for combinations that had sales. Empty = zero.

### 2. `Products` — SKU master + inventory (powers Product & Inventory)

One row per SKU.

| SKU | Product | Brand | Category | Collection | Price | Cost | Stock | ReorderLevel | Status |
|-----|---------|-------|----------|------------|-------|------|-------|--------------|--------|

`Status`: Active / Low stock / Out of stock / Discontinued. Update `Stock`
weekly (or connect your inventory export later).

### 3. `Channels` — weekly channel & customer metrics (powers Customer & Channel)

One row per week × brand × channel.

| Week | Brand | Channel | Sessions | Orders | NewCustomers | ReturningCustomers | AOV | AdSpend |
|------|-------|---------|----------|--------|--------------|--------------------|-----|---------|

Sessions = site visits / footfall / marketplace views, whichever fits the
channel. AdSpend here lets the dashboard compute ROAS per channel.

### 4. `Competitors` — powers Competition Tracker

One row per observation (a launch, a price change, a campaign you spotted).

| Date | Competitor | Type | Title | Detail | PricePoint | Channel | Link |
|------|-----------|------|-------|--------|------------|---------|------|

`Type`: Launch / Price / Campaign / Store / Collab.

### 5. `Industry` — powers Industry Watch

Same shape as Loomline's Trend Radar `Data` sheet, so you can either
copy rows across or point an `IMPORTRANGE` at the Loomline spreadsheet
and get the feed for free:

| Date | Title | Source | Category | Sentiment | Score | Insight | Link |
|------|-------|--------|----------|-----------|-------|---------|------|

### 6. `Actions` — the action board (read **and written** by the app)

| ID | Title | Owner | Due | Source | Status | Created |
|----|-------|-------|-----|--------|--------|---------|

`Status`: To do / In progress / Done. The dashboard writes here via POST —
don't reorder these columns.

### 7. `Targets` — monthly targets (powers "vs plan" deltas)

| Month | Brand | RevenueTarget | UnitsTarget | NewCustomersTarget |
|-------|-------|---------------|-------------|--------------------|

---

## Rules that keep this painless

1. **The sheet is the database, the dashboard does the math.** Never put
   formulas, totals, or % rows in the tabs — enter raw facts only.
2. **Lock the vocabulary.** Data Validation dropdowns on Brand, Channel,
   Category, Collection, Geo, Status. One misspelled "Hulabalooo" splits
   your charts in two.
3. **Weekly cadence.** One 20-minute Friday session filling Sales + Channels
   beats daily entry. Products/Competitors update as things happen.
4. **Don't split into multiple spreadsheets.** One file, seven tabs. Apps
   Script opens it once; everything stays in sync.

---

## Backend setup (`backend/Code.gs`)

1. Create the Google Sheet with the 7 tabs above; copy its ID from the URL.
2. [script.google.com](https://script.google.com) → New project → paste
   `Code.gs` → set `SPREADSHEET_ID` in CONFIG.
3. Project Settings → Script Properties → add `ANTHROPIC_API_KEY` (for the
   Ask feature; optional).
4. Deploy → New deployment → **Web app** → Execute as *Me*, access
   *Anyone* → copy the `/exec` URL.
5. Test: open `<url>?mode=all` in a browser — you should see JSON.

### API

| Call | Returns |
|------|---------|
| `GET ?mode=all` | every table in one payload (dashboard startup) |
| `GET ?mode=sales` (or products / channels / competitors / industry / actions / targets) | one table |
| `POST {action:'ask', prompt}` | Claude answer |
| `POST {action:'addAction', card}` | new action-board card |
| `POST {action:'updateAction', id, status}` | move a card |

---

## Hosting on your domain

The dashboard is a static HTML file — no server needed:

1. Host `index.html` on **Netlify** or **Cloudflare Pages** (both free, both
   support custom domains + HTTPS; GitHub Pages needs a paid plan for
   private repos).
2. Point your domain (e.g. `balooo.yourdomain.com`) at it via a CNAME record.
3. The page fetches the Apps Script `/exec` URL directly from the browser —
   Apps Script web apps allow cross-origin GET/POST, so no proxy is needed.

---

## Repo layout

```
backend/Code.gs        Apps Script API (paste into script.google.com)
prototype/             Canva prototype (Balooo.dc.html + support.js)
index.html             (coming) production dashboard wired to the API
```
