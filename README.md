# Business Loomline (Balooo)

Business decision layer for **The Hullabalooo × The Pappy Show**.
A Google Sheet is the database, Google Apps Script is the API, and a single
HTML dashboard (hosted on your own domain) is the front end.

```
You / your team          Google Sheet              Apps Script            Your domain
enter weekly data  --->  8 tabs, 1 table    --->   doGet() reads    --->  dashboard fetches
(or import CSVs)         per function              tabs, returns JSON     JSON + renders
```

- Spreadsheet: `1bY2_I44g5bI0Gfwnn-I_7zD8HouhoH1ZOgXMneBvdHA`
- Web app: deployed from `backend/Code.gs` (Deploy → Manage deployments → New version after every code change)

---

## The spreadsheet: 8 tabs (+3 optional)

Every tab is a clean table: row 1 = headers (snake_case), one record per row.
No merged cells, no totals rows, no formulas-as-data — the dashboard does the math.

### MASTER — config (1 row)

| last_updated | brands | fiscal_start_month | currency |
|---|---|---|---|
| 18/07/2026 | 2 | 4 | INR |

### BRANDS — reference (1 row per brand)

| brand_id | brand_name | color_primary | status |
|---|---|---|---|
| HB | The Hullabalooo | #A13E63 | Active |
| PS | The Pappy Show | #2F6D77 | Active |

`brand_id` is what every other tab uses; the API resolves it to the name.
`color_primary` colours that brand everywhere in the dashboard.

### REVENUE — weekly actuals (the core table)

One row per **week × brand × channel × category × collection × geography**
that had sales. Only combinations that sold — absent = zero.

| date | brand_id | channel | category | collection | geography | revenue | units_sold |
|---|---|---|---|---|---|---|---|
| 13/07/2026 | HB | Website | Dresses | Core | Mumbai | 189000 | 42 |
| 13/07/2026 | HB | Marketplace | Dresses | Core | Delhi NCR | 96500 | 21 |
| 13/07/2026 | PS | Marketplace | Tees | New Season | Bangalore | 61200 | 44 |

- `date`: the **Monday of the week**, as a real date cell.
- `revenue` in ₹, plain number (no ₹, no commas).
- Keep channel/category/collection/geography vocabularies fixed with
  Data Validation dropdowns.

### COSTS — operating expenses

One row per cost entry (weekly or monthly, as you incur them).

| date | brand_id | cost_category | department | amount |
|---|---|---|---|---|
| 15/07/2026 | HB | Marketing | Growth | 250000 |
| 01/07/2026 | PS | Salaries | Ops | 400000 |
| 10/07/2026 | HB | Logistics | Fulfilment | 85000 |

Feeds "Operating costs" and "Est. operating profit" on the Brands screen.

### INVENTORY — SKU-level stock

One row per SKU. Update `quantity_on_hand` weekly.

| sku | brand_id | quantity_on_hand | reorder_level | unit_cost | warehouse |
|---|---|---|---|---|---|
| HB-DRS-001 | HB | 4 | 10 | 1500 | Mumbai |
| PS-TEE-014 | PS | 0 | 15 | 420 | Delhi |

Optional extra columns the dashboard also understands:
`product_name`, `category`, `collection`, `unit_price` (selling price — add it
to get real margin numbers instead of estimates), `status`
(Active / Discontinued).

### CHANNELS — platform performance

One row per **date × channel**, from your ad/platform reports.

| date | channel_name | impressions | clicks | conversions | cost |
|---|---|---|---|---|---|
| 13/07/2026 | Instagram | 120000 | 5400 | 130 | 35000 |
| 13/07/2026 | Website | 40000 | 8000 | 210 | 15000 |

`channel_name` must use the same vocabulary as REVENUE's `channel` so the
dashboard can join them (revenue + conversion + ROAS in one table).

### CUSTOMERS — monthly cohorts

One row per month of first-time buyers.

| cohort_month | new_customers | repeat_rate | avg_ltv | acquisition_cost |
|---|---|---|---|---|
| 01/06/2026 | 380 | 0.31 | 6100 | 780 |
| 01/05/2026 | 410 | 0.26 | 5600 | 850 |

- `repeat_rate`: fraction (0.31) or percent (31) — both work.
- Powers the cohort table and LTV:CAC health check.

### ALERTS — action items (read **and written** by the app)

| title | owner | status | action_required | due_date |
|---|---|---|---|---|
| Reorder HB-DRS-001 | Vinay | To do | Stock below reorder level | 25/07/2026 |

`status`: To do / In progress / Done. The dashboard's Action board moves
cards by rewriting this column. Optional: add an `id` column (leave it blank;
the app fills it) for more robust matching.

### Optional tabs — add later, the dashboard picks them up automatically

- **COMPETITORS**: `date, competitor, type, title, detail, price_point, channel, link`
  (`type`: Launch / Price / Campaign / Store / Collab) → screen 05.
- **INDUSTRY**: `date, title, source, category, sentiment, score, insight, link`
  — IMPORTRANGE this from the Loomline Trend Radar sheet → screen 06.
- **TARGETS**: `month, brand_id, revenue_target, units_target, new_customers_target`
  → "behind target pace" alerts.

---

## Weekly rhythm (≈20 min, Fridays)

1. REVENUE — add this week's rows per brand × channel × category.
2. CHANNELS — copy impressions/clicks/conversions/cost from ad managers.
3. INVENTORY — update `quantity_on_hand` (or paste your stock export).
4. COSTS — log anything new.
5. Monthly: one CUSTOMERS row when the month closes.

## Backend setup

1. `backend/Code.gs` is already pointed at the spreadsheet.
2. script.google.com → paste the file → Script Properties: `ANTHROPIC_API_KEY`
   (optional, for Ask Balooo).
3. Deploy → Web app → Execute as *Me*, access *Anyone* → after ANY code
   change: Manage deployments → ✏️ → New version → Deploy.
4. Test: `<exec-url>?mode=all` should return JSON.

## Hosting

`index.html` is static — host on Netlify or Cloudflare Pages (free, custom
domains, HTTPS). The page ships with the web-app URL baked in; `?api=` can
override it.

## Repo layout

```
backend/Code.gs        Apps Script API (paste into script.google.com)
prototype/             Canva prototype (Balooo.dc.html + support.js)
index.html             production dashboard — all six screens wired to the API
```
