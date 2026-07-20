# Business Loomline — Data Model for the "Business Math" prototype

This document turns the **Balooo Business Math** prototype (`Balooo Business Math.dc.html`)
into a concrete, spreadsheet-backed data model. It is written to be reviewed *before* we
change any code, and to double as the **How-to** guide you paste into the Google Sheet.

The prototype has **9 screens**. Most of the numbers on them are real, but a large share are
currently **inferred from free text** or **hard-coded as illustrative** because the sheet
doesn't yet carry the underlying field. The goal here is: *every number the UI shows should be
computed from a real column, with a defined formula.*

---

## 1. What the prototype actually computes (and what it's faking today)

| # | Screen | Real, from data | Faked / inferred today | Root cause |
|---|--------|-----------------|------------------------|------------|
| 01 | The math | invested, earned, stock-at-retail, break-even, recovery % | GST split (rates guessed by department) | no tax columns on COSTS |
| 02 | P&L (Schedule III) | revenue, expenses by head/dept/behaviour | "Changes in inventories = nil", COGS, tax split | no `unit_cost`; no GST columns |
| 03 | Where money went | totals per line item | Function → sub-group tree (regex on `item` text) | no `cost_function` / `cost_stage` |
| 04 | What we've made | price, price bands, value-vs-volume | silhouette, proportion, technique, colour, fabric | derived by regex from `product_name` |
| 05 | Sales & channels | revenue by channel / city, sell-through | **age & gender (100% illustrative)**, ROAS/funnel, returns=0 | CHANNELS empty; no demographics; no returns |
| 06 | Inventory | retail value | fabric (inferred), "all qty = 1", "all low stock" | no `fabric`, `quantity_on_hand` unused |
| 07 | YoY overview | FY26 actuals | forward years (from scenario run-rate) | fine — projection, not data |
| 08 | Actions & alerts | ALERTS rows, computed alerts, revenue by collection | — | fine |
| 09 | Scenario planner | defaults seeded from sheet | variable cost/unit ≈ cogs ÷ pieces (proxy) | no true `unit_cost`; no cost dates |

**The five fixes that unlock ~80% of the value**

1. **`INVENTORY.unit_cost`** — the single most important field. Unlocks true margin, a real COGS
   line, closing-stock-at-cost, "changes in inventory" in the P&L, and an honest contribution
   margin in the planner. Its absence is why the P&L shows a large loss and why margin is missing.
2. **`INVENTORY.quantity_on_hand` + `reorder_level`** (actually used) — real stock levels and
   low-stock flags instead of "every SKU = 1 unit, all flagged low".
3. **`COSTS.date`** — currently blank. Unlocks time-series, monthly run-rate, and a real
   "marketing per month" for the planner/YoY instead of a hard-coded ₹15,000.
4. **`COSTS.cost_function` + `cost_stage` + explicit GST** — turns the cost tree, the P&L
   grouping, and the tax model from *regex guesses* into *declared facts*.
5. **`INVENTORY.fabric` + `collection`** — the Inventory and Product screens stop guessing cloth
   from the product name.

Everything else (demographics, channel funnel, returns, targets) is additive and can follow.

---

## 2. The tabs

Convention (unchanged): row 1 = headers in `snake_case`, one record per row, numbers plain
(no `₹`, no commas), dates as real date cells, fixed vocabularies via Data-Validation dropdowns.
`R` = required, `Rec` = recommended, `O` = optional (dashboard degrades gracefully if blank).

### MASTER — config (1 row)

| column | R/O | example | powers |
|---|---|---|---|
| last_updated | R | 18/07/2026 | freshness stamp |
| brands | R | 2 | sanity |
| fiscal_start_month | R | 4 | fiscal-year bucketing (YoY, P&L period) |
| currency | R | INR | formatting |
| gst_registered | Rec | No | switches the tax model from "ITC accrues as an asset" to "output GST charged" later |

### BRANDS — reference (1 row per brand)

| column | R/O | example | powers |
|---|---|---|---|
| brand_id | R | HB | join key used by every other tab |
| brand_name | R | The Hullabalooo | labels |
| color_primary | R | #A13E63 | brand colour everywhere |
| status | R | Active | filter |

### REVENUE — every sale (the core actuals table)

One row per sale. For single-piece SKUs this is literally one row per garment sold.

| column | R/O | example | powers / formula role |
|---|---|---|---|
| date | R | 17/07/2026 | time-series, cohorts (Monday-of-week is fine for weekly aggregates) |
| brand_id | R | HB | brand filter, per-brand P&L |
| sku | **Rec** | HB1HE-01 | **links the sale to the exact piece in INVENTORY → realised margin, exact sell-through, decrements stock** |
| style_family | **Rec** | HB1HE | rolls the sale up to its family → "Revenue by style family" (Sales) pairs with cost-by-family (Where money went). Derived from `sku` if left blank. |
| channel | R | Retail | channel matrix; must match `CHANNELS.channel_name` |
| category | R | Shirt | sell-through by category |
| collection | R | Launch · Harm the Harmonium | "where revenue comes from" (screen 08) |
| geography | R | Mumbai | city map (screen 05) |
| revenue | R | 10000 | net money received (after discount, before nothing else) |
| units_sold | R | 1 | units math, AOV |
| discount_amount | O | 0 | list-vs-net analysis, planner discount seed |
| returns_units | O | 0 | real return rate (today hard-coded 0) |
| returns_value | O | 0 | net revenue = revenue − returns_value |
| customer_id | O | C-018 | links to CUSTOMERS → real LTV, repeat rate, cohorts (see §4) |

> Net revenue used everywhere = `revenue − returns_value`. If `returns_*` are blank they are 0,
> so nothing changes until you start logging returns.

### COSTS — every rupee spent (redesigned)

One row per expense/invoice line. This is the tab that most needs structure.

| column | R/O | example | powers / formula role |
|---|---|---|---|
| date | **R** (fill it) | 02/07/2026 | monthly run-rate, "marketing/month", YoY FY buckets |
| brand_id | R | HB *(or `Shared`)* | per-brand cost allocation; `Shared` = split company-wide |
| cost_function | **R** | Product | **L1 of the cost tree & P&L behaviour** — dropdown: `Product` / `Marketing & brand` / `Overheads` |
| cost_stage | R for Product | Experiment | Product split — dropdown: `Experiment` / `Final production` / `—` |
| department | R | Fabric | L2 sub-group & Schedule III sub-line — dropdown (Fabric, Paints, Digital Print, Articles, Stitching, Marketing, Legal, Salaries, Rent, Logistics…) |
| line_item | R | Bamboo fabric 15m | the human description (was `cost_category`) |
| amount | R | 8100 | gross cash paid (GST-inclusive) |
| gst_amount | **Rec** | 386 | exact recoverable ITC from the invoice; `base = amount − gst_amount`. Blank → estimated by `department` rate |
| style_family | Rec | HB1HE | attributes production spend to a **style family** (lighter than per-SKU while small) → "Product cost by style family" + a rough make-cost per piece. Links to `INVENTORY.style_family`. A specific `sku` also works if you'd rather go per-piece. |
| vendor | O | Fabriclore | spend-by-vendor (future) |
| paid | O | Yes | cashflow view (future) |

**Cost taxonomy (the dropdown truth table).** These three declared columns replace all the
regex the prototype runs on the item text:

| cost_function | cost_stage | typical departments | Schedule III head |
|---|---|---|---|
| Product | Experiment | Art Experiment, sampling, recce | Cost of materials consumed |
| Product | Final production | Fabric, Paints, Digital Print, Articles, Stitching | Cost of materials consumed |
| Marketing & brand | — | Marketing (shoots, ads, content, website, hosting) | Other expenses → Advertising & promotion |
| Overheads | — | Legal, Salaries, Rent, Logistics, Software | Other expenses (or Employee benefits / Finance costs) |

### INVENTORY — every piece you've made (redesigned)

One row per SKU. Fix the current duplicate-SKU problem: each SKU must be **unique**.

| column | R/O | example | powers / formula role |
|---|---|---|---|
| sku | R (unique) | HB-SHIRT-0004 | join key for REVENUE & COSTS |
| brand_id | R | HB | brand filter |
| product_name | R | Unisex — Harm the Harmonium | labels, price ladder |
| category | R | Shirt | assortment, sell-through — dropdown |
| collection | Rec | Launch · Harm the Harmonium | ties stock to a drop |
| fabric | **R** | Bamboo | Inventory-by-fabric (today inferred) — dropdown |
| unit_cost | **R** | 3200 | **make-cost/piece → margin, COGS, closing stock at cost, planner variable cost** |
| unit_price | R | 10100 | list/retail price → stock value, price architecture |
| quantity_on_hand | **R** | 1 | real stock (today ignored) |
| reorder_level | R | 2 | low-stock flag = `qty ≤ reorder_level` |
| warehouse | O | Mumbai | location |
| status | Rec | Active | `Active` / `Discontinued` / `Sold-out` filter |
| silhouette | O | Shirt | screen-04 exactness; else derived from category |
| proportion | O | Regular | screen-04 exactness; else derived |
| technique | O | Digital print | screen-04 exactness; else derived from name |
| colour | O | Charcoal | colour-story (today flagged "illustrative") |

> Required = `sku, brand_id, product_name, category, fabric, unit_cost, unit_price,
> quantity_on_hand, reorder_level`. The four style attributes are optional polish — the
> dashboard keeps its derivation fallback so you can add them later.

### CHANNELS — platform performance (schema unchanged, needs data)

One row per `date × channel_name`. **`channel_name` must use the same words as `REVENUE.channel`**
so the two join.

| column | R/O | example | powers / formula |
|---|---|---|---|
| date | R | 13/07/2026 | trend |
| channel_name | R | Instagram | join to REVENUE.channel |
| impressions | R | 120000 | funnel top |
| clicks | R | 5400 | CTR = clicks ÷ impressions |
| conversions | R | 130 | CVR = conversions ÷ clicks; CAC = cost ÷ conversions |
| cost | R | 35000 | ROAS = channel revenue ÷ cost |

### CUSTOMERS — the buyers (recommended: one row per person)

The prototype's cohort table and the **entirely illustrative** age/gender bars both want this.
Modelling **one row per customer** (not per month) makes LTV, repeat-rate, cohorts, CAC and
demographics all *derived from one source* instead of hand-maintained summary numbers that drift.

| column | R/O | example | powers / formula |
|---|---|---|---|
| customer_id | R | C-018 | join to REVENUE.customer_id |
| brand_id | O | HB | per-brand cohorts |
| first_order_date | R | 17/07/2026 | cohort bucket (by month) |
| city | O | Mumbai | geo cross-tab |
| age_band | Rec | 25–34 | age chart (today faked) — dropdown: `18–24/25–34/35–44/45+` |
| gender | Rec | Men | gender chart (today faked) — dropdown: `Women/Men/Unspecified` |
| acquisition_channel | O | Word of mouth | CAC by channel |
| acquisition_cost | O | 0 | LTV:CAC |

Derived, no longer typed by hand:
`LTV = Σ net revenue for that customer_id`; `repeat_rate = customers with ≥2 orders ÷ all
customers`; `new_customers[m] = count(first_order_date in month m)`.

> **Fallback:** if you'd rather keep the current monthly-summary shape
> (`cohort_month, new_customers, repeat_rate, avg_ltv, acquisition_cost`), the dashboard can
> read that instead — but LTV/repeat then have to be typed and can drift. This is the one real
> design fork in §7.

### ALERTS — the action board (add `id`)

| column | R/O | example | powers |
|---|---|---|---|
| id | Rec (app-filled) | act_1737… | robust status writes from the board |
| title | R | Finalise PS website | card title |
| owner | R | Vinay | assignee chip |
| status | R | To do | `To do / In progress / Done` — the board rewrites this |
| action_required | R | Get on a call with Rohit | card body |
| due_date | O | 23/07/2026 | due chip |

### TARGETS — plan (new, optional) → powers YoY "vs plan"

| column | R/O | example |
|---|---|---|
| month | R | 01/08/2026 |
| brand_id | R | HB |
| revenue_target | R | 200000 |
| units_target | O | 25 |
| new_customers_target | O | 20 |

### MATERIALS — raw-material stock (new) → powers the Materials screen

One row per raw material (thread, paint, button, fabric, packaging…). Estimate-friendly:
`status` alone is enough; quantities are optional.

| column | R/O | example | powers |
|---|---|---|---|
| material | R | White thread | label |
| category | R | Thread | grouping — Fabric/Thread/Paint/Dye/Button/Trim/Packaging/Article/Other |
| unit | O | spool | metre/spool/jar/piece/packet/kg/set |
| quantity_on_hand | O | 2 | optional estimate |
| reorder_level | O | 5 | derives low-stock when status is blank |
| status | R | Running low | the at-a-glance — In stock / Running low / Out of stock |
| on_order | O | Yes | "what's pending" — excludes it from the Buy-next list |
| expected_date | O | 01/08/2026 | when the reorder lands |
| supplier | O | Local | where to reorder |
| notes | O | | anything |

### SKU_MATERIALS — bill of materials (optional) → link materials to pieces

Only if you want to know which pieces use a material. One row per `sku × material`.

| column | R/O | example |
|---|---|---|
| sku | R | HB1HE-01 |
| material | R | Bamboo fabric |
| qty_used | O | 1.5 |
| unit | O | metre |
| notes | O | shirt body |

---

## 3. Deriving `unit_cost` when you don't track it per piece

If you can tag production costs to a SKU (`COSTS.sku`), then for each piece:

```
unit_cost(sku) = Σ base_amount of COSTS rows where cost_function = 'Product' AND sku = <sku>
```

When a cost covers a *batch* (e.g. "Bamboo fabric 15m" makes 4 shirts), either split it across the
SKUs it produced, or record it once with the batch's SKU and set `quantity_on_hand` accordingly.
Until per-SKU tagging exists, the dashboard falls back to the blunt proxy the prototype uses now:

```
variable_cost_per_unit ≈ (Σ base of Product costs) ÷ (pieces made)      [company-wide average]
pieces made           = count(INVENTORY) + Σ REVENUE.units_sold
```

Typing a real `unit_cost` per SKU is what upgrades every margin number from *estimate* to *fact*.

---

## 4. The math (canonical formulas)

All money sums use **net revenue** `= revenue − returns_value` and **ex-GST base cost**
`= amount − gst_amount` (or `amount ÷ (1 + rate)` if `gst_amount` is blank).

**Tax split (per cost line)**
```
base = amount − gst_amount            (fallback: amount ÷ (1 + gst_rate[department]))
itc  = amount − base                  (recoverable input tax credit — an ASSET, not an expense)
default rates: services (Marketing, Legal) 18% · materials/textiles 5%
```

**01 · The math**
```
cash_out        = Σ COSTS.amount
input_cost      = Σ base ;  gst_paid = Σ itc
earned          = Σ net revenue
stock_retail    = Σ (unit_price × quantity_on_hand)  over Active stock
recovered       = earned ÷ cash_out
if_all_sold     = earned + stock_retail
potential       = min(1, if_all_sold ÷ cash_out)
gap_to_be       = max(0, cash_out − earned)
pieces_to_be    = gap_to_be ÷ avg_contribution_per_piece      (avg_contribution = Σ(price−cost)/pieces)
```

**02 · P&L (Schedule III, ex-GST)**
```
Revenue from operations = Σ net revenue
COGS / materials consumed = Σ base where cost_function = 'Product'
Changes in inventories    = −(closing_stock_at_cost − opening_stock_at_cost)     ← needs unit_cost
   closing_stock_at_cost  = Σ (unit_cost × quantity_on_hand)
Other expenses            = Σ base where cost_function ∈ {Marketing & brand, Overheads}
Total expenses            = materials_consumed + changes_in_inventories + other_expenses
PBT = Revenue + other_income − Total expenses ;  PAT = PBT − tax
Memo: GST input credit = Σ itc   (balance-sheet asset, shown below the statement)
```

**03 · Cost tree** — group by `cost_function` → `department` → `line_item`; Product also split by
`cost_stage` (Experiment vs Final production). All three are now columns, no inference.

**04 · Product / range**
```
gross_margin_pct(sku) = (unit_price − unit_cost) ÷ unit_price
dimension aggregates group INVENTORY by fabric / silhouette / technique / colour / category
value share = Σ price in group ÷ Σ price all ;  volume share = count group ÷ count all
price bands: Entry <₹5k · Core ₹5k–12k · Premium >₹12k
```

**05 · Sales & channels**
```
CTR  = clicks ÷ impressions ;  CVR = conversions ÷ clicks
CAC  = cost ÷ conversions   ;  ROAS = channel_revenue ÷ channel_cost
AOV  = net revenue ÷ orders
sell_through(cat) = units_sold(cat) ÷ (units_sold(cat) + quantity_on_hand(cat))
audience = distribution of CUSTOMERS by age_band / gender (weighted by count or by their LTV)
```

**06 · Inventory**
```
units_on_hand = Σ quantity_on_hand ;  retail_value = Σ price×qty ;  cost_value = Σ unit_cost×qty
low_stock     = quantity_on_hand ≤ reorder_level
weeks_cover   = quantity_on_hand ÷ avg_weekly_units_sold(sku)          (optional, needs sales rate)
group by fabric for the ledger
```

**09 · Scenario planner & 07 · YoY**
```
eff_asp        = asp × (1 − discount)
contribution   = eff_asp − variable_cost_per_unit
cm%            = contribution ÷ eff_asp
monthly_profit = units × contribution − monthly_overhead
be_units/mo    = monthly_overhead ÷ contribution
payback_months = (cash_out − earned) ÷ monthly_profit
monthly_overhead = (Σ base of Marketing & brand + Overheads) ÷ months_active     ← needs COSTS.date
YoY: FY26 = actuals; forward years annualise the planner run-rate and compound by the growth slider
```

---

## 5. How-to examples (paste-ready grey rows)

> Grey rows are **examples of the format** — replace with real data. Numbers plain, dates real.

**REVENUE**
```
date        brand_id  sku              channel      category  collection                      geography  revenue  units_sold  discount_amount  returns_units  returns_value  customer_id
17/07/2026  HB        HB-SHIRT-0004    Retail       Shirt     Launch · Harm the Harmonium     Mumbai     10000    1           0                0              0              C-018
20/06/2026  HB        HB-SHIRT-0001    Retail       Shirt     Launch · Compliments            Mumbai     8000     1           0                0              0              C-011
```

**COSTS**
```
date        brand_id  cost_function      cost_stage        department     line_item                        amount  gst_amount  sku            vendor
02/07/2026  HB        Product            Final production  Fabric         Bamboo fabric 15m                8100    386         HB-SHIRT-0004  Fabriclore
28/06/2026  HB        Product            Experiment        Art Experiment Linocut material                3000    143         —              —
15/07/2026  Shared    Marketing & brand  —                 Marketing      1st collection shoot — equipment 15000   2288        —              —
10/07/2026  Shared    Overheads          —                 Legal          IP registration                 15000   2288        —              —
```

**INVENTORY**
```
sku            brand_id  product_name                 category  collection                    fabric  unit_cost  unit_price  quantity_on_hand  reorder_level  warehouse  status  silhouette  proportion  technique       colour
HB-SHIRT-0004  HB        Unisex — Harm the Harmonium  Shirt     Launch · Harm the Harmonium   Bamboo  3200       10100       1                 2              Mumbai     Active  Shirt       Regular     Digital print   Charcoal
HB-CROP-0003   HB        Female Croptop — Portals     Crop Shirt Launch · Compliments         Egyptian Cotton 3600 9999      1                 2              Mumbai     Active  Crop top    Cropped     Digital print   Rust
```

**CHANNELS**
```
date        channel_name  impressions  clicks  conversions  cost
13/07/2026  Instagram     120000       5400    130          35000
13/07/2026  Website       40000        8000    210          15000
```

**CUSTOMERS** (per-person model)
```
customer_id  brand_id  first_order_date  city    age_band  gender  acquisition_channel  acquisition_cost
C-018        HB        17/07/2026        Mumbai  25–34     Men     Word of mouth        0
C-011        HB        20/06/2026        Mumbai  35–44     Women   Word of mouth        0
```

**ALERTS**
```
id      title                 owner  status  action_required                         due_date
(blank) Finalise PS website   Vinay  To do   Get on a call with Rohit to finalise    23/07/2026
```

**TARGETS**
```
month       brand_id  revenue_target  units_target  new_customers_target
01/08/2026  HB        200000          25            20
```

---

## 6. What changes in code (for later, not part of this review)

- **`backend/Code.gs`** — add `TARGETS` to `CONFIG.SHEETS` (already lists the other tabs); no
  reader changes needed, it returns whatever columns exist.
- **`index.html`** — the current dashboard reads a subset; wiring the new columns
  (`unit_cost`, `cost_function`, `fabric`, per-customer model, etc.) is where the prototype's 9
  screens get ported onto live data. This is the implementation phase after you sign off on §2–§5.

---

## 7. The one open decision

**Customer modelling.** Recommended: **one row per customer** (§CUSTOMERS above) so LTV, repeat
rate, cohorts and the age/gender charts are all *derived* and can't drift. The alternative is to
keep the current **monthly-summary** shape and type those numbers by hand. Everything else in this
document is a clean, additive extension of your existing tabs. Tell me which customer model you
want and I'll (a) generate the ready-to-import `.xlsx` with dropdowns + How-to tab, and (b) wire
`index.html` + `Code.gs` to the new columns.
